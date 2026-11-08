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
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
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

    it('should handle cascade deletion across categories, topics, tasks, and timetable blocks in one atomic batch', async () => {
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

  describe('3. Cloud-to-Local Sync (Remote snapshots update local storage and stores)', () => {
    it('should apply added and modified remote blocks to local storage and update Zustand store', async () => {
      startFirestoreSync(testUid);
      expect(mockCapturedSnapshotCallbacks['timetableBlocks']).toBeDefined();

      const remoteBlock: TimetableBlock = {
        id: 'blk_remote_1',
        title: 'Team Standup',
        categoryId: 'cat_career',
        priority: 'high',
        date: '2026-11-08',
        startTime: '10:00',
        durationMin: 30,
        isFixed: true,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 200, nanoseconds: 0 },
        updatedAt: { seconds: 200, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };

      // Trigger remote snapshot callback with 'added' change
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_remote_1', data: () => remoteBlock }],
        docChanges: () => [
          {
            type: 'added',
            doc: { id: 'blk_remote_1', data: () => remoteBlock },
          },
        ],
      });

      // Verify block is saved to storage
      const localBlocks = await getStorage().getTimetableBlocks();
      expect(localBlocks.find((b) => b.id === 'blk_remote_1')).toBeDefined();

      // Verify timetable store is updated
      expect(useTimetableStore.getState().blocks.some((b) => b.id === 'blk_remote_1')).toBe(true);
    });

    it('should reflect remote block deletions locally', async () => {
      // First save a block locally
      const existingBlock: TimetableBlock = {
        id: 'blk_to_delete',
        title: 'Temporary Block',
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
      await getStorage().saveTimetableBlock(existingBlock);
      useTimetableStore.setState({ blocks: [existingBlock] });

      startFirestoreSync(testUid);

      // Remote sends 'removed' change
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: true,
        metadata: { fromCache: false },
        docs: [],
        docChanges: () => [
          {
            type: 'removed',
            doc: { id: 'blk_to_delete', data: () => existingBlock },
          },
        ],
      });

      // Block must be deleted from storage
      const localBlocks = await getStorage().getTimetableBlocks();
      expect(localBlocks.find((b) => b.id === 'blk_to_delete')).toBeUndefined();

      // Block must be deleted from Zustand store
      expect(useTimetableStore.getState().blocks.find((b) => b.id === 'blk_to_delete')).toBeUndefined();
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

  describe('4. Loop Prevention & Storage Mutation Listener', () => {
    it('should NOT trigger local-to-cloud sync when changes are applied from remote (breaks loop)', async () => {
      startFirestoreSync(testUid);

      const remoteBlock: TimetableBlock = {
        id: 'blk_no_loop',
        title: 'Incoming Remote Block',
        categoryId: 'cat_career',
        priority: 'medium',
        date: '2026-11-08',
        startTime: '15:00',
        durationMin: 45,
        isFixed: false,
        notes: '',
        status: 'pending',
        createdAt: { seconds: 300, nanoseconds: 0 },
        updatedAt: { seconds: 300, nanoseconds: 0 },
        actualStart: null,
        actualEnd: null,
        actualHistory: [],
      };

      mockSetDoc.mockClear();

      // Trigger incoming remote snapshot
      await mockCapturedSnapshotCallbacks['timetableBlocks']({
        empty: false,
        metadata: { fromCache: false },
        docs: [{ id: 'blk_no_loop', data: () => remoteBlock }],
        docChanges: () => [
          {
            type: 'added',
            doc: { id: 'blk_no_loop', data: () => remoteBlock },
          },
        ],
      });

      // While applying remote sync, storage.saveTimetableBlock was called,
      // but isApplyingRemoteSync suppressed sending it back to setDoc
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe('5. First-Time Migration', () => {
    it('should upload all local blocks, categories, topics, and tasks to cloud in batch', async () => {
      // Seed initial data in adapter
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
    });
  });
});
