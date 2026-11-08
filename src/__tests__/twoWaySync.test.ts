import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isRemoteTimestampNewer,
  toEpochMillis,
  handleLocalMutationToCloud,
  migrateAllLocalDataToCloud,
  checkCloudDataExists,
  startFirestoreSync,
  stopFirestoreSync,
  isCurrentlyApplyingRemoteSync,
  withRemoteSyncSuppressed,
  commitInChunks,
  getSyncStatus,
} from '../services/sync/firestoreSyncService';
import { AsyncStorageAdapter } from '../services/storage/AsyncStorageAdapter';
import { setStorageForTesting, getStorage } from '../services/storage';
import { useTimetableStore } from '../stores/timetableStore';
import { useCategoryTopicStore } from '../stores/categoryTopicStore';
import { TimetableBlock } from '../types/timetable';
import { Category } from '../types/category';
import { Topic } from '../types/topic';
import { TopicTask } from '../types/topicTask';

// Mock Firebase Firestore methods
const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn();
let mockCapturedSnapshotCallbacks: Record<string, (snapshot: any) => Promise<void>> = {};

const mockBatchSet = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

const mockBatch = {
  set: mockBatchSet,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, ...pathSegments) => ({
    id: pathSegments[pathSegments.length - 1],
    path: pathSegments.join('/'),
  })),
  doc: jest.fn((db, ...pathSegments) => ({
    id: pathSegments[pathSegments.length - 1],
    path: pathSegments.join('/'),
  })),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  writeBatch: () => mockBatch,
  onSnapshot: jest.fn((colRef: any, onNext: any) => {
    mockCapturedSnapshotCallbacks[colRef.id] = onNext;
    return jest.fn(); // unsubscribe function
  }),
}));

jest.mock('../services/firebase/webFirebase', () => ({
  getFirestoreDb: jest.fn(() => ({})),
  isFirebaseConfigured: jest.fn(() => true),
}));

describe('Two-Way Firestore Synchronisation Suite', () => {
  let adapter: AsyncStorageAdapter;
  const testUid = 'user_test_123';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCapturedSnapshotCallbacks = {};
    mockBatchCommit.mockResolvedValue(undefined);
    stopFirestoreSync();

    (AsyncStorage.setItem as any) = async (key: string, value: string) => {
      return (AsyncStorage as any).multiSet([[key, value]]);
    };
    await AsyncStorage.clear();

    adapter = new AsyncStorageAdapter();
    setStorageForTesting(adapter);

    useTimetableStore.setState({ blocks: [], isLoading: false });
    useCategoryTopicStore.setState({ categories: [], topics: [], topicTasks: [], isLoading: false });
  });

  afterEach(() => {
    stopFirestoreSync();
  });

  describe('1. Timestamp Comparisons & Conflict Prevention', () => {
    it('should correctly convert timestamps to epoch milliseconds', () => {
      expect(toEpochMillis(null)).toBe(0);
      expect(toEpochMillis(1700000000000)).toBe(1700000000000);
      expect(toEpochMillis({ seconds: 1700000, nanoseconds: 500000000 })).toBe(1700000500);
      expect(toEpochMillis({ toMillis: () => 123456789 })).toBe(123456789);
    });

    it('should determine whether remote timestamp is newer than local timestamp', () => {
      const local = { seconds: 100, nanoseconds: 0 };
      const olderRemote = { seconds: 99, nanoseconds: 0 };
      const identicalRemote = { seconds: 100, nanoseconds: 0 };
      const newerRemoteSec = { seconds: 101, nanoseconds: 0 };
      const newerRemoteNano = { seconds: 100, nanoseconds: 500 };

      expect(isRemoteTimestampNewer(olderRemote, local)).toBe(false);
      expect(isRemoteTimestampNewer(identicalRemote, local)).toBe(false);
      expect(isRemoteTimestampNewer(newerRemoteSec, local)).toBe(true);
      expect(isRemoteTimestampNewer(newerRemoteNano, local)).toBe(true);
      expect(isRemoteTimestampNewer(newerRemoteSec, null)).toBe(true);
      expect(isRemoteTimestampNewer(null, local)).toBe(false);
    });
  });

  describe('2. Local-to-Cloud Sync (Mutations immediately dispatch to Firestore)', () => {
    it('should sync timetable block create and update to Firestore', async () => {
      const testBlock: TimetableBlock = {
        id: 'blk_test_1',
        title: 'Deep Work',
        categoryId: 'cat_career',
        priority: 'high',
        date: '2026-11-08',
        startTime: '09:00',
        durationMin: 90,
        isFixed: false,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };

      await handleLocalMutationToCloud({ type: 'block:save', block: testBlock }, testUid);

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const [docRef, data, options] = mockSetDoc.mock.calls[0];
      expect(docRef.id).toBe('blk_test_1');
      expect(data.title).toBe('Deep Work');
      expect(options).toEqual({ merge: true });
    });

    it('should sync timetable block deletion to Firestore', async () => {
      await handleLocalMutationToCloud({ type: 'block:delete', blockId: 'blk_test_1' }, testUid);

      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      const [docRef] = mockDeleteDoc.mock.calls[0];
      expect(docRef.id).toBe('blk_test_1');
    });

    it('should sync category creation and reorder in batch', async () => {
      const cat1: Category = {
        id: 'cat_1',
        name: 'Work',
        priority: 'high',
        sortOrder: 1024,
        color: '#3B82F6',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
      };
      const cat2: Category = {
        id: 'cat_2',
        name: 'Health',
        priority: 'medium',
        sortOrder: 2048,
        color: '#10B981',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
      };

      await handleLocalMutationToCloud({ type: 'category:save', category: cat1 }, testUid);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cat_1' }),
        cat1,
        { merge: true }
      );

      await handleLocalMutationToCloud({ type: 'category:reorder', categories: [cat2, cat1] }, testUid);
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should handle cascade deletion across categories, topics, tasks, and timetable blocks in batches', async () => {
      await handleLocalMutationToCloud(
        {
          type: 'cascade:deleteCategory',
          categoryId: 'cat_1',
          deletedTopicIds: ['top_1', 'top_2'],
          deletedTaskIds: ['task_1'],
          deletedBlockIds: ['blk_1', 'blk_2'],
        },
        testUid
      );

      // Total deletions in batch: 1 category + 2 topics + 1 task + 2 blocks = 6
      expect(mockBatchDelete).toHaveBeenCalledTimes(6);
      expect(mockBatchCommit).toHaveBeenCalled();
    });
  });

  describe('3. Cloud-to-Local Sync & Initial Reconciliation (REGRESSION TESTS)', () => {
    it('Initial reconciliation: cloud has records, local has offline-created records — all survive and converge', async () => {
      // Local storage already has an offline-created block
      const offlineLocalBlock: TimetableBlock = {
        id: 'blk_offline_created',
        title: 'Offline Morning Yoga',
        categoryId: 'cat_health',
        priority: 'medium',
        date: '2026-11-08',
        startTime: '07:00',
        durationMin: 30,
        isFixed: false,
        notes: 'Created while device was offline',
        status: 'pending',
        createdAt: { seconds: 50, nanoseconds: 0 },
        updatedAt: { seconds: 50, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };
      await getStorage().saveTimetableBlock(offlineLocalBlock);
      useTimetableStore.setState({ blocks: [offlineLocalBlock] });

      startFirestoreSync(testUid);
      expect(mockCapturedSnapshotCallbacks['timetableBlocks']).toBeDefined();

      // Cloud snapshot contains a DIFFERENT block
      const cloudOnlyBlock: TimetableBlock = {
        id: 'blk_cloud_only',
        title: 'Cloud Work Review',
        categoryId: 'cat_career',
        priority: 'high',
        date: '2026-11-08',
        startTime: '10:00',
        durationMin: 45,
        isFixed: true,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };

      mockSetDoc.mockClear();

      // Trigger initial snapshot
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_cloud_only', data: () => cloudOnlyBlock }],
        docChanges: () => [
          {
            type: 'added',
            doc: { id: 'blk_cloud_only', data: () => cloudOnlyBlock },
          },
        ],
      });

      // 1. Both records MUST survive locally
      const localBlocks = await getStorage().getTimetableBlocks();
      expect(localBlocks.find((b) => b.id === 'blk_cloud_only')).toBeDefined();
      expect(localBlocks.find((b) => b.id === 'blk_offline_created')).toBeDefined();

      // 2. Timetable store has both records
      const storeBlocks = useTimetableStore.getState().blocks;
      expect(storeBlocks.some((b) => b.id === 'blk_cloud_only')).toBe(true);
      expect(storeBlocks.some((b) => b.id === 'blk_offline_created')).toBe(true);

      // 3. The offline-created local block was uploaded to Firestore (not deleted!)
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'blk_offline_created' }),
        offlineLocalBlock,
        { merge: true }
      );
    });

    it('Subsequent snapshot: genuine remote deletion still removes local record', async () => {
      // 1. Initial snapshot with two blocks
      const block1: TimetableBlock = {
        id: 'blk_keep',
        title: 'Keep Block',
        categoryId: 'cat_career',
        priority: 'high',
        date: '2026-11-08',
        startTime: '09:00',
        durationMin: 60,
        isFixed: false,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };
      const block2: TimetableBlock = {
        id: 'blk_to_be_deleted_remotely',
        title: 'Delete Block',
        categoryId: 'cat_career',
        priority: 'medium',
        date: '2026-11-08',
        startTime: '11:00',
        durationMin: 30,
        isFixed: false,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };

      startFirestoreSync(testUid);

      // Initial snapshot brings both blocks
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [
          { id: 'blk_keep', data: () => block1 },
          { id: 'blk_to_be_deleted_remotely', data: () => block2 },
        ],
        docChanges: () => [
          { type: 'added', doc: { id: 'blk_keep', data: () => block1 } },
          { type: 'added', doc: { id: 'blk_to_be_deleted_remotely', data: () => block2 } },
        ],
      });

      expect(useTimetableStore.getState().blocks.length).toBe(2);

      // 2. Subsequent snapshot delivers a genuine remote deletion
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_keep', data: () => block1 }],
        docChanges: () => [
          {
            type: 'removed',
            doc: { id: 'blk_to_be_deleted_remotely', data: () => block2 },
          },
        ],
      });

      // block2 is deleted locally
      const localBlocks = await getStorage().getTimetableBlocks();
      expect(localBlocks.find((b) => b.id === 'blk_to_be_deleted_remotely')).toBeUndefined();
      expect(localBlocks.find((b) => b.id === 'blk_keep')).toBeDefined();

      // store reflects the deletion
      expect(useTimetableStore.getState().blocks.find((b) => b.id === 'blk_to_be_deleted_remotely')).toBeUndefined();
      expect(useTimetableStore.getState().blocks.find((b) => b.id === 'blk_keep')).toBeDefined();
    });

    it('should reject stale remote snapshots that have older timestamps than local edits', async () => {
      // Local block has been updated at timestamp seconds: 500
      const localBlock: TimetableBlock = {
        id: 'blk_conflict',
        title: 'Local Fresh Edit',
        categoryId: 'cat_career',
        priority: 'high',
        date: '2026-11-08',
        startTime: '14:00',
        durationMin: 60,
        isFixed: false,
        notes: 'Locally updated notes',
        status: 'done',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 500, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };
      await getStorage().saveTimetableBlock(localBlock);
      useTimetableStore.setState({ blocks: [localBlock] });

      startFirestoreSync(testUid);

      // Stale remote arrives with timestamp seconds: 300
      const staleRemoteBlock: TimetableBlock = {
        ...localBlock,
        title: 'Stale Cloud Version',
        notes: 'Stale notes',
        updatedAt: { seconds: 300, nanoseconds: 0 },
      };

      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_conflict', data: () => staleRemoteBlock }],
        docChanges: () => [
          {
            type: 'modified',
            doc: { id: 'blk_conflict', data: () => staleRemoteBlock },
          },
        ],
      });

      // Local storage must keep the fresh local edit
      const currentBlocks = await getStorage().getTimetableBlocks();
      const current = currentBlocks.find((b) => b.id === 'blk_conflict');
      expect(current?.title).toBe('Local Fresh Edit');
      expect(current?.notes).toBe('Locally updated notes');
    });
  });

  describe('4. Concurrent Loop Prevention (REGRESSION TEST)', () => {
    it('Multiple collection listeners running concurrently should never cause echo writes', async () => {
      startFirestoreSync(testUid);

      const initialTimestamp = { seconds: 2000000000, nanoseconds: 0 };
      const updatedTimestamp = { seconds: 2000000001, nanoseconds: 0 };

      const initialBlock: TimetableBlock = {
        id: 'blk_concurrent',
        title: 'Initial Concurrent Block',
        categoryId: 'cat_career',
        priority: 'medium',
        date: '2026-11-08',
        startTime: '16:00',
        durationMin: 30,
        isFixed: false,
        notes: '',
        status: 'pending',
        createdAt: initialTimestamp,
        updatedAt: initialTimestamp,
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };

      const initialCat: Category = {
        id: 'cat_career',
        name: 'Career & Growth',
        priority: 'high',
        sortOrder: 1024,
        color: '#2563EB',
        createdAt: initialTimestamp,
        updatedAt: initialTimestamp,
      };

      // 1. Establish initial snapshot baseline
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_concurrent', data: () => initialBlock }],
        docChanges: () => [
          { type: 'added', doc: { id: 'blk_concurrent', data: () => initialBlock } },
        ],
      });

      await mockCapturedSnapshotCallbacks['categories']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'cat_career', data: () => initialCat }],
        docChanges: () => [
          { type: 'added', doc: { id: 'cat_career', data: () => initialCat } },
        ],
      });

      mockSetDoc.mockClear();

      // 2. Incoming concurrent updates from remote
      const updatedBlock: TimetableBlock = {
        ...initialBlock,
        title: 'Updated Remote Block',
        updatedAt: updatedTimestamp,
      };

      const updatedCat: Category = {
        ...initialCat,
        name: 'Career & Deep Focus',
        updatedAt: updatedTimestamp,
      };

      // Trigger two listeners concurrently
      const promiseBlocks = mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_concurrent', data: () => updatedBlock }],
        docChanges: () => [
          { type: 'modified', doc: { id: 'blk_concurrent', data: () => updatedBlock } },
        ],
      });

      const promiseCats = mockCapturedSnapshotCallbacks['categories']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'cat_career', data: () => updatedCat }],
        docChanges: () => [
          { type: 'modified', doc: { id: 'cat_career', data: () => updatedCat } },
        ],
      });

      // While running concurrently, suppression depth must remain active (> 0)
      expect(isCurrentlyApplyingRemoteSync()).toBe(true);

      await Promise.all([promiseBlocks, promiseCats]);

      // After both complete, suppression returns to false (0)
      expect(isCurrentlyApplyingRemoteSync()).toBe(false);

      // Neither concurrent listener echoed remote data back as a local-to-cloud write
      expect(mockSetDoc).not.toHaveBeenCalled();

      // Verify updates were applied locally
      const blocks = await getStorage().getTimetableBlocks();
      expect(blocks.find((b) => b.id === 'blk_concurrent')?.title).toBe('Updated Remote Block');
      const cats = await getStorage().getCategories();
      expect(cats.find((c) => c.id === 'cat_career')?.name).toBe('Career & Deep Focus');
    });
  });

  describe('5. Batch Chunks & Partial Failure Reporting (REGRESSION TEST)', () => {
    it('should report partial batch failure accurately without marking sync state as synced', async () => {
      // Simulate failure on the second batch chunk
      let commitCallCount = 0;
      mockBatchCommit.mockImplementation(async () => {
        commitCallCount++;
        if (commitCallCount === 2) {
          throw new Error('Firestore quota exceeded on chunk 2');
        }
      });

      // Create 450 operations -> 2 chunks (400 in chunk 1, 50 in chunk 2)
      const operations: ((batch: any) => void)[] = [];
      for (let i = 0; i < 450; i++) {
        operations.push((batch) => batch.set({ id: `doc_${i}` }, { i }));
      }

      await expect(commitInChunks({} as any, operations)).rejects.toThrow(
        /Batch write failed at chunk 2 of 2 \(1 committed\)/
      );

      const status = getSyncStatus();
      expect(status.state).toBe('error');
      expect(status.state).not.toBe('synced');
      expect(status.error).toContain('Batch write failed at chunk 2 of 2 (1 committed)');
    });
  });

  describe('6. First-Time Migration', () => {
    it('should upload all local blocks, categories, topics, and tasks to cloud in sequential batches', async () => {
      const block: TimetableBlock = {
        id: 'blk_mig_1',
        title: 'Migrated Block',
        categoryId: 'cat_career',
        priority: 'high',
        date: '2026-11-08',
        startTime: '08:00',
        durationMin: 60,
        isFixed: false,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 100, nanoseconds: 0 },
        updatedAt: { seconds: 100, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };
      await adapter.saveTimetableBlock(block);

      const res = await migrateAllLocalDataToCloud(testUid);

      expect(res.blocksCount).toBeGreaterThanOrEqual(1);
      expect(res.categoriesCount).toBeGreaterThanOrEqual(1);
      expect(mockBatchCommit).toHaveBeenCalled();

      // Ensure local data is preserved intact
      const localBlocks = await adapter.getTimetableBlocks();
      expect(localBlocks.some((b) => b.id === 'blk_mig_1')).toBe(true);
      expect(getSyncStatus().state).toBe('synced');
    });
  });
});
