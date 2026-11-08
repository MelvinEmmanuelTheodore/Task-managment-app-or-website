import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Unsubscribe,
  WriteBatch,
  Firestore,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../firebase/webFirebase';
import { getStorage } from '../storage';
import { StorageMutationEvent } from '../storage/IStorageAdapter';
import { useTimetableStore } from '../../stores/timetableStore';
import { useCategoryTopicStore } from '../../stores/categoryTopicStore';
import { TimetableBlock } from '../../types/timetable';
import { Category } from '../../types/category';
import { Topic } from '../../types/topic';
import { TopicTask } from '../../types/topicTask';

let activeUnsubscribes: Unsubscribe[] = [];
let storageMutationUnsubscribe: (() => void) | null = null;
let currentSyncUid: string | null = null;

// Re-entrant suppression counter to prevent echo writes across concurrent collection listeners
let remoteSyncSuppressionDepth = 0;

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
let currentSyncState: SyncState = 'idle';
let currentSyncError: string | null = null;

export function getSyncStatus(): { state: SyncState; error: string | null } {
  return {
    state: currentSyncState,
    error: currentSyncError,
  };
}

export function isCurrentlyApplyingRemoteSync(): boolean {
  return remoteSyncSuppressionDepth > 0;
}

/**
 * Execute an asynchronous action with remote sync suppression active.
 * Uses a re-entrant depth counter so overlapping/concurrent listeners never prematurely
 * disable suppression.
 */
export async function withRemoteSyncSuppressed<T>(action: () => Promise<T>): Promise<T> {
  remoteSyncSuppressionDepth++;
  try {
    return await action();
  } finally {
    remoteSyncSuppressionDepth = Math.max(0, remoteSyncSuppressionDepth - 1);
  }
}

/**
 * Safely converts any timestamp representation (Firestore Timestamp, AppTimestamp, Date, number)
 * to epoch milliseconds for precise conflict comparisons.
 */
export function toEpochMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1e6) : 0);
  }
  if (typeof ts === 'number') {
    return ts;
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  return 0;
}

/**
 * Compares two timestamps. Returns true if remote timestamp is strictly newer than local timestamp.
 */
export function isRemoteTimestampNewer(remoteTs: any, localTs: any): boolean {
  if (!remoteTs) return false;
  if (!localTs) return true;
  const remoteMs = toEpochMillis(remoteTs);
  const localMs = toEpochMillis(localTs);

  if (remoteMs !== localMs) {
    return remoteMs > localMs;
  }

  const remoteNano = remoteTs && typeof remoteTs.nanoseconds === 'number' ? remoteTs.nanoseconds : 0;
  const localNano = localTs && typeof localTs.nanoseconds === 'number' ? localTs.nanoseconds : 0;
  return remoteNano > localNano;
}

export interface ChunkedBatchResult {
  totalOperations: number;
  committedChunks: number;
  totalChunks: number;
}

/**
 * Executes operations in chunks of up to 400 to respect Firestore's 500-operation per-batch limit.
 * NOTE: Each chunk commits as its own independent atomic batch. If a chunk fails, previous
 * chunks remain committed. Partial failures are accurately tracked, reported, and thrown.
 */
export async function commitInChunks(
  db: Firestore,
  operations: ((batch: WriteBatch) => void)[]
): Promise<ChunkedBatchResult> {
  if (operations.length === 0) {
    return { totalOperations: 0, committedChunks: 0, totalChunks: 0 };
  }

  const CHUNK_SIZE = 400;
  const totalChunks = Math.ceil(operations.length / CHUNK_SIZE);
  let committedChunks = 0;

  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + CHUNK_SIZE);

    for (const op of chunk) {
      op(batch);
    }

    try {
      await batch.commit();
      committedChunks++;
    } catch (err: any) {
      const errorMsg = `Batch write failed at chunk ${chunkIndex + 1} of ${totalChunks} (${committedChunks} committed): ${err?.message || err}`;
      currentSyncState = 'error';
      currentSyncError = errorMsg;
      throw new Error(errorMsg);
    }
  }

  return {
    totalOperations: operations.length,
    committedChunks,
    totalChunks,
  };
}

/**
 * Check if the user already has data in Firestore cloud
 */
export async function checkCloudDataExists(uid: string): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db || !uid) return false;

  try {
    const blocksRef = collection(db, 'users', uid, 'timetableBlocks');
    const snap = await getDocs(blocksRef);
    return !snap.empty;
  } catch (err) {
    console.warn('[Sync] checkCloudDataExists error:', err);
    return false;
  }
}

/**
 * Upload all current local data (blocks, categories, topics, tasks) to Firestore in sequential batches.
 * Idempotent, safe, and preserves all completed and skipped statuses.
 */
export async function migrateAllLocalDataToCloud(uid: string): Promise<{
  blocksCount: number;
  categoriesCount: number;
  topicsCount: number;
  tasksCount: number;
}> {
  const db = getFirestoreDb();
  if (!db || !uid) {
    throw new Error('Cloud database is not available or user is not signed in.');
  }

  currentSyncState = 'syncing';
  currentSyncError = null;

  try {
    const envelope = await getStorage().loadAll();
    const { timetableBlocks, categories, topics, topicTasks } = envelope;

    const operations: ((batch: WriteBatch) => void)[] = [];

    // 1. Timetable Blocks
    for (const block of timetableBlocks) {
      operations.push((batch) => {
        const blockRef = doc(db, 'users', uid, 'timetableBlocks', block.id);
        batch.set(blockRef, block, { merge: true });
      });
    }

    // 2. Categories
    for (const cat of categories) {
      operations.push((batch) => {
        const catRef = doc(db, 'users', uid, 'categories', cat.id);
        batch.set(catRef, cat, { merge: true });
      });
    }

    // 3. Topics
    for (const top of topics) {
      operations.push((batch) => {
        const topRef = doc(db, 'users', uid, 'topics', top.id);
        batch.set(topRef, top, { merge: true });
      });
    }

    // 4. Tasks
    for (const t of topicTasks) {
      operations.push((batch) => {
        const taskRef = doc(db, 'users', uid, 'topicTasks', t.id);
        batch.set(taskRef, t, { merge: true });
      });
    }

    await commitInChunks(db, operations);

    currentSyncState = 'synced';
    return {
      blocksCount: timetableBlocks.length,
      categoriesCount: categories.length,
      topicsCount: topics.length,
      tasksCount: topicTasks.length,
    };
  } catch (err: any) {
    currentSyncState = 'error';
    currentSyncError = err?.message || 'Migration failed';
    throw err;
  }
}

/**
 * Handle local storage mutation events and immediately synchronise them to Firestore.
 * Suppressed if remote sync is actively writing to local storage.
 */
export async function handleLocalMutationToCloud(
  event: StorageMutationEvent,
  uid: string
): Promise<void> {
  if (isCurrentlyApplyingRemoteSync() || !uid) {
    return;
  }

  const db = getFirestoreDb();
  if (!db) return;

  try {
    currentSyncState = 'syncing';
    switch (event.type) {
      case 'block:save': {
        const blockRef = doc(db, 'users', uid, 'timetableBlocks', event.block.id);
        await setDoc(blockRef, event.block, { merge: true });
        break;
      }
      case 'block:delete': {
        const blockRef = doc(db, 'users', uid, 'timetableBlocks', event.blockId);
        await deleteDoc(blockRef);
        break;
      }
      case 'category:save': {
        const catRef = doc(db, 'users', uid, 'categories', event.category.id);
        await setDoc(catRef, event.category, { merge: true });
        break;
      }
      case 'category:delete': {
        const catRef = doc(db, 'users', uid, 'categories', event.categoryId);
        await deleteDoc(catRef);
        break;
      }
      case 'category:reorder': {
        const ops: ((batch: WriteBatch) => void)[] = event.categories.map((cat) => (batch) => {
          const catRef = doc(db, 'users', uid, 'categories', cat.id);
          batch.set(catRef, cat, { merge: true });
        });
        await commitInChunks(db, ops);
        break;
      }
      case 'topic:save': {
        const topRef = doc(db, 'users', uid, 'topics', event.topic.id);
        await setDoc(topRef, event.topic, { merge: true });
        break;
      }
      case 'topic:delete': {
        const ops: ((batch: WriteBatch) => void)[] = [
          (batch) => {
            const topRef = doc(db, 'users', uid, 'topics', event.topicId);
            batch.delete(topRef);
          },
        ];
        if (event.deletedTaskIds) {
          for (const taskId of event.deletedTaskIds) {
            ops.push((batch) => {
              const taskRef = doc(db, 'users', uid, 'topicTasks', taskId);
              batch.delete(taskRef);
            });
          }
        }
        await commitInChunks(db, ops);
        break;
      }
      case 'topic:reorder': {
        const ops: ((batch: WriteBatch) => void)[] = event.topics.map((top) => (batch) => {
          const topRef = doc(db, 'users', uid, 'topics', top.id);
          batch.set(topRef, top, { merge: true });
        });
        await commitInChunks(db, ops);
        break;
      }
      case 'task:save': {
        const taskRef = doc(db, 'users', uid, 'topicTasks', event.task.id);
        await setDoc(taskRef, event.task, { merge: true });
        break;
      }
      case 'task:delete': {
        const taskRef = doc(db, 'users', uid, 'topicTasks', event.taskId);
        await deleteDoc(taskRef);
        break;
      }
      case 'cascade:deleteCategory': {
        const ops: ((batch: WriteBatch) => void)[] = [
          (batch) => {
            batch.delete(doc(db, 'users', uid, 'categories', event.categoryId));
          },
        ];
        for (const topicId of event.deletedTopicIds) {
          ops.push((batch) => {
            batch.delete(doc(db, 'users', uid, 'topics', topicId));
          });
        }
        for (const taskId of event.deletedTaskIds) {
          ops.push((batch) => {
            batch.delete(doc(db, 'users', uid, 'topicTasks', taskId));
          });
        }
        for (const blockId of event.deletedBlockIds) {
          ops.push((batch) => {
            batch.delete(doc(db, 'users', uid, 'timetableBlocks', blockId));
          });
        }
        await commitInChunks(db, ops);
        break;
      }
      case 'move:deleteCategory': {
        const ops: ((batch: WriteBatch) => void)[] = [
          (batch) => {
            batch.delete(doc(db, 'users', uid, 'categories', event.fromCategoryId));
          },
        ];
        for (const topic of event.updatedTopics) {
          ops.push((batch) => {
            batch.set(doc(db, 'users', uid, 'topics', topic.id), topic, { merge: true });
          });
        }
        for (const block of event.updatedBlocks) {
          ops.push((batch) => {
            batch.set(doc(db, 'users', uid, 'timetableBlocks', block.id), block, { merge: true });
          });
        }
        await commitInChunks(db, ops);
        break;
      }
      case 'all:replace': {
        await migrateAllLocalDataToCloud(uid);
        break;
      }
    }
    currentSyncState = 'synced';
  } catch (err: any) {
    console.warn('[Sync] Local-to-cloud write error:', err);
    currentSyncState = 'error';
    currentSyncError = err?.message || 'Sync write failed';
    throw err;
  }
}

/**
 * Start real-time Firestore synchronization for a signed-in user.
 * 1. Registers storage mutation observer for local-to-cloud sync.
 * 2. Initial reconciliation: bidirectional merge preserving all offline/local-created records.
 * 3. Subsequent snapshots: processes real-time additions, updates, and genuine remote deletions.
 * 4. Conflict resolution: timestamp comparisons prevent stale overwrites.
 * 5. Loop prevention: concurrency-safe suppression counter protects all collection listeners.
 */
export function startFirestoreSync(uid: string): () => void {
  if (currentSyncUid === uid && activeUnsubscribes.length > 0) {
    return stopFirestoreSync;
  }

  stopFirestoreSync(); // Clean up any existing listeners

  const db = getFirestoreDb();
  if (!db || !uid || !isFirebaseConfigured()) {
    return () => {};
  }

  currentSyncUid = uid;
  currentSyncState = 'synced';
  currentSyncError = null;

  // 1. Storage mutation listener (Local -> Cloud)
  storageMutationUnsubscribe = getStorage().registerMutationListener((event) => {
    handleLocalMutationToCloud(event, uid).catch((err) => {
      console.warn('[Sync] Unhandled local mutation sync error:', err);
    });
  });

  // Track initial snapshot loads for each collection
  let isInitialBlocks = true;
  let isInitialCats = true;
  let isInitialTopics = true;
  let isInitialTasks = true;

  // 2. Timetable Blocks Listener (Cloud <-> Local)
  const blocksCol = collection(db, 'users', uid, 'timetableBlocks');
  const unsubBlocks = onSnapshot(
    blocksCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache && isInitialBlocks) {
        return;
      }

      await withRemoteSyncSuppressed(async () => {
        try {
          currentSyncState = 'syncing';
          const currentBlocks = await getStorage().getTimetableBlocks();
          const blockMap = new Map<string, TimetableBlock>(currentBlocks.map((b) => [b.id, b]));
          let hasChanges = false;

          if (isInitialBlocks) {
            isInitialBlocks = false;
            const remoteDocMap = new Map<string, TimetableBlock>();
            snapshot.docs.forEach((d) => {
              remoteDocMap.set(d.id, d.data() as TimetableBlock);
            });

            // A. Reconcile all remote docs against local
            for (const [remoteId, remoteBlock] of remoteDocMap.entries()) {
              const localBlock = blockMap.get(remoteId);
              if (!localBlock || isRemoteTimestampNewer(remoteBlock.updatedAt, localBlock.updatedAt)) {
                // Cloud-only or cloud is newer: apply locally
                blockMap.set(remoteId, remoteBlock);
                await getStorage().saveTimetableBlock(remoteBlock);
                hasChanges = true;
              } else if (localBlock && isRemoteTimestampNewer(localBlock.updatedAt, remoteBlock.updatedAt)) {
                // Local is strictly newer: upload local to Firestore
                const blockRef = doc(db, 'users', uid, 'timetableBlocks', localBlock.id);
                try {
                  await setDoc(blockRef, localBlock, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload newer local block to cloud:', err);
                }
              }
            }

            // B. Preserve & upload local-only records (offline-created or pre-existing)
            for (const [localId, localBlock] of blockMap.entries()) {
              if (!remoteDocMap.has(localId)) {
                const blockRef = doc(db, 'users', uid, 'timetableBlocks', localBlock.id);
                try {
                  await setDoc(blockRef, localBlock, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload local-only block to cloud:', err);
                }
              }
            }
          } else {
            // Subsequent snapshots: process incremental docChanges
            const docChanges = snapshot.docChanges();
            for (const change of docChanges) {
              const docId = change.doc.id;
              if (change.type === 'removed') {
                // Genuine remote deletion!
                if (blockMap.has(docId)) {
                  blockMap.delete(docId);
                  await getStorage().deleteTimetableBlock(docId);
                  hasChanges = true;
                }
              } else {
                // 'added' or 'modified'
                const remoteBlock = change.doc.data() as TimetableBlock;
                const localBlock = blockMap.get(docId);

                if (!localBlock || isRemoteTimestampNewer(remoteBlock.updatedAt, localBlock.updatedAt)) {
                  blockMap.set(docId, remoteBlock);
                  await getStorage().saveTimetableBlock(remoteBlock);
                  hasChanges = true;
                } else if (localBlock && isRemoteTimestampNewer(localBlock.updatedAt, remoteBlock.updatedAt)) {
                  const blockRef = doc(db, 'users', uid, 'timetableBlocks', localBlock.id);
                  try {
                    await setDoc(blockRef, localBlock, { merge: true });
                  } catch (err) {
                    console.warn('[Sync] Failed to upload newer local block:', err);
                  }
                }
              }
            }
          }

          if (hasChanges) {
            useTimetableStore.getState().setBlocksFromEnvelope(Array.from(blockMap.values()));
          }
          currentSyncState = 'synced';
        } catch (err: any) {
          console.warn('[Sync] Blocks listener warning:', err);
          currentSyncState = 'error';
          currentSyncError = err?.message || 'Blocks sync error';
        }
      });
    },
    (err) => {
      console.warn('[Sync] Blocks listener error:', err);
      currentSyncState = 'error';
      currentSyncError = err?.message || 'Blocks listener failed';
    }
  );
  activeUnsubscribes.push(unsubBlocks);

  // 3. Categories Listener (Cloud <-> Local)
  const catsCol = collection(db, 'users', uid, 'categories');
  const unsubCats = onSnapshot(
    catsCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache && isInitialCats) {
        return;
      }

      await withRemoteSyncSuppressed(async () => {
        try {
          currentSyncState = 'syncing';
          const currentCats = await getStorage().getCategories();
          const catMap = new Map<string, Category>(currentCats.map((c) => [c.id, c]));
          let hasChanges = false;

          if (isInitialCats) {
            isInitialCats = false;
            const remoteDocMap = new Map<string, Category>();
            snapshot.docs.forEach((d) => {
              remoteDocMap.set(d.id, d.data() as Category);
            });

            for (const [remoteId, remoteCat] of remoteDocMap.entries()) {
              const localCat = catMap.get(remoteId);
              if (!localCat || isRemoteTimestampNewer(remoteCat.updatedAt, localCat.updatedAt)) {
                catMap.set(remoteId, remoteCat);
                await getStorage().saveCategory(remoteCat);
                hasChanges = true;
              } else if (localCat && isRemoteTimestampNewer(localCat.updatedAt, remoteCat.updatedAt)) {
                const catRef = doc(db, 'users', uid, 'categories', localCat.id);
                try {
                  await setDoc(catRef, localCat, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload newer local category:', err);
                }
              }
            }

            for (const [localId, localCat] of catMap.entries()) {
              if (!remoteDocMap.has(localId)) {
                const catRef = doc(db, 'users', uid, 'categories', localCat.id);
                try {
                  await setDoc(catRef, localCat, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload local-only category:', err);
                }
              }
            }
          } else {
            const docChanges = snapshot.docChanges();
            for (const change of docChanges) {
              const docId = change.doc.id;
              if (change.type === 'removed') {
                if (catMap.has(docId)) {
                  catMap.delete(docId);
                  await getStorage().deleteCategory(docId);
                  hasChanges = true;
                }
              } else {
                const remoteCat = change.doc.data() as Category;
                const localCat = catMap.get(docId);

                if (!localCat || isRemoteTimestampNewer(remoteCat.updatedAt, localCat.updatedAt)) {
                  catMap.set(docId, remoteCat);
                  await getStorage().saveCategory(remoteCat);
                  hasChanges = true;
                } else if (localCat && isRemoteTimestampNewer(localCat.updatedAt, remoteCat.updatedAt)) {
                  const catRef = doc(db, 'users', uid, 'categories', localCat.id);
                  try {
                    await setDoc(catRef, localCat, { merge: true });
                  } catch (err) {
                    console.warn('[Sync] Failed to upload newer local category:', err);
                  }
                }
              }
            }
          }

          if (hasChanges) {
            await useCategoryTopicStore.getState().loadInitialData(true);
          }
          currentSyncState = 'synced';
        } catch (err: any) {
          console.warn('[Sync] Categories listener warning:', err);
          currentSyncState = 'error';
          currentSyncError = err?.message || 'Categories sync error';
        }
      });
    },
    (err) => {
      console.warn('[Sync] Categories listener error:', err);
      currentSyncState = 'error';
      currentSyncError = err?.message || 'Categories listener failed';
    }
  );
  activeUnsubscribes.push(unsubCats);

  // 4. Topics Listener (Cloud <-> Local)
  const topicsCol = collection(db, 'users', uid, 'topics');
  const unsubTopics = onSnapshot(
    topicsCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache && isInitialTopics) {
        return;
      }

      await withRemoteSyncSuppressed(async () => {
        try {
          currentSyncState = 'syncing';
          const currentTopics = await getStorage().getTopics();
          const topicMap = new Map<string, Topic>(currentTopics.map((t) => [t.id, t]));
          let hasChanges = false;

          if (isInitialTopics) {
            isInitialTopics = false;
            const remoteDocMap = new Map<string, Topic>();
            snapshot.docs.forEach((d) => {
              remoteDocMap.set(d.id, d.data() as Topic);
            });

            for (const [remoteId, remoteTopic] of remoteDocMap.entries()) {
              const localTopic = topicMap.get(remoteId);
              if (!localTopic || isRemoteTimestampNewer(remoteTopic.updatedAt, localTopic.updatedAt)) {
                topicMap.set(remoteId, remoteTopic);
                await getStorage().saveTopic(remoteTopic);
                hasChanges = true;
              } else if (localTopic && isRemoteTimestampNewer(localTopic.updatedAt, remoteTopic.updatedAt)) {
                const topRef = doc(db, 'users', uid, 'topics', localTopic.id);
                try {
                  await setDoc(topRef, localTopic, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload newer local topic:', err);
                }
              }
            }

            for (const [localId, localTopic] of topicMap.entries()) {
              if (!remoteDocMap.has(localId)) {
                const topRef = doc(db, 'users', uid, 'topics', localTopic.id);
                try {
                  await setDoc(topRef, localTopic, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload local-only topic:', err);
                }
              }
            }
          } else {
            const docChanges = snapshot.docChanges();
            for (const change of docChanges) {
              const docId = change.doc.id;
              if (change.type === 'removed') {
                if (topicMap.has(docId)) {
                  topicMap.delete(docId);
                  await getStorage().deleteTopic(docId);
                  hasChanges = true;
                }
              } else {
                const remoteTopic = change.doc.data() as Topic;
                const localTopic = topicMap.get(docId);

                if (!localTopic || isRemoteTimestampNewer(remoteTopic.updatedAt, localTopic.updatedAt)) {
                  topicMap.set(docId, remoteTopic);
                  await getStorage().saveTopic(remoteTopic);
                  hasChanges = true;
                } else if (localTopic && isRemoteTimestampNewer(localTopic.updatedAt, remoteTopic.updatedAt)) {
                  const topRef = doc(db, 'users', uid, 'topics', localTopic.id);
                  try {
                    await setDoc(topRef, localTopic, { merge: true });
                  } catch (err) {
                    console.warn('[Sync] Failed to upload newer local topic:', err);
                  }
                }
              }
            }
          }

          if (hasChanges) {
            await useCategoryTopicStore.getState().loadInitialData(true);
          }
          currentSyncState = 'synced';
        } catch (err: any) {
          console.warn('[Sync] Topics listener warning:', err);
          currentSyncState = 'error';
          currentSyncError = err?.message || 'Topics sync error';
        }
      });
    },
    (err) => {
      console.warn('[Sync] Topics listener error:', err);
      currentSyncState = 'error';
      currentSyncError = err?.message || 'Topics listener failed';
    }
  );
  activeUnsubscribes.push(unsubTopics);

  // 5. Topic Tasks Listener (Cloud <-> Local)
  const tasksCol = collection(db, 'users', uid, 'topicTasks');
  const unsubTasks = onSnapshot(
    tasksCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache && isInitialTasks) {
        return;
      }

      await withRemoteSyncSuppressed(async () => {
        try {
          currentSyncState = 'syncing';
          const currentTasks = await getStorage().getTopicTasks();
          const taskMap = new Map<string, TopicTask>(currentTasks.map((t) => [t.id, t]));
          let hasChanges = false;

          if (isInitialTasks) {
            isInitialTasks = false;
            const remoteDocMap = new Map<string, TopicTask>();
            snapshot.docs.forEach((d) => {
              remoteDocMap.set(d.id, d.data() as TopicTask);
            });

            for (const [remoteId, remoteTask] of remoteDocMap.entries()) {
              const localTask = taskMap.get(remoteId);
              if (!localTask || isRemoteTimestampNewer(remoteTask.updatedAt, localTask.updatedAt)) {
                taskMap.set(remoteId, remoteTask);
                await getStorage().saveTopicTask(remoteTask);
                hasChanges = true;
              } else if (localTask && isRemoteTimestampNewer(localTask.updatedAt, remoteTask.updatedAt)) {
                const taskRef = doc(db, 'users', uid, 'topicTasks', localTask.id);
                try {
                  await setDoc(taskRef, localTask, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload newer local task:', err);
                }
              }
            }

            for (const [localId, localTask] of taskMap.entries()) {
              if (!remoteDocMap.has(localId)) {
                const taskRef = doc(db, 'users', uid, 'topicTasks', localTask.id);
                try {
                  await setDoc(taskRef, localTask, { merge: true });
                } catch (err) {
                  console.warn('[Sync] Failed to upload local-only task:', err);
                }
              }
            }
          } else {
            const docChanges = snapshot.docChanges();
            for (const change of docChanges) {
              const docId = change.doc.id;
              if (change.type === 'removed') {
                if (taskMap.has(docId)) {
                  taskMap.delete(docId);
                  await getStorage().deleteTopicTask(docId);
                  hasChanges = true;
                }
              } else {
                const remoteTask = change.doc.data() as TopicTask;
                const localTask = taskMap.get(docId);

                if (!localTask || isRemoteTimestampNewer(remoteTask.updatedAt, localTask.updatedAt)) {
                  taskMap.set(docId, remoteTask);
                  await getStorage().saveTopicTask(remoteTask);
                  hasChanges = true;
                } else if (localTask && isRemoteTimestampNewer(localTask.updatedAt, remoteTask.updatedAt)) {
                  const taskRef = doc(db, 'users', uid, 'topicTasks', localTask.id);
                  try {
                    await setDoc(taskRef, localTask, { merge: true });
                  } catch (err) {
                    console.warn('[Sync] Failed to upload newer local task:', err);
                  }
                }
              }
            }
          }

          if (hasChanges) {
            await useCategoryTopicStore.getState().loadInitialData(true);
          }
          currentSyncState = 'synced';
        } catch (err: any) {
          console.warn('[Sync] Tasks listener warning:', err);
          currentSyncState = 'error';
          currentSyncError = err?.message || 'Tasks sync error';
        }
      });
    },
    (err) => {
      console.warn('[Sync] Tasks listener error:', err);
      currentSyncState = 'error';
      currentSyncError = err?.message || 'Tasks listener failed';
    }
  );
  activeUnsubscribes.push(unsubTasks);

  return stopFirestoreSync;
}

/**
 * Stop all active Firestore real-time listeners and storage mutation observers
 */
export function stopFirestoreSync(): void {
  for (const unsub of activeUnsubscribes) {
    try {
      unsub();
    } catch {}
  }
  activeUnsubscribes = [];

  if (storageMutationUnsubscribe) {
    try {
      storageMutationUnsubscribe();
    } catch {}
    storageMutationUnsubscribe = null;
  }

  currentSyncUid = null;
  remoteSyncSuppressionDepth = 0;
  currentSyncState = 'idle';
  currentSyncError = null;
}

/**
 * Helper to sync a single timetable block up to Cloud Firestore
 */
export async function syncBlockToCloud(uid: string, block: TimetableBlock): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !uid) return;
  try {
    const blockRef = doc(db, 'users', uid, 'timetableBlocks', block.id);
    await setDoc(blockRef, block, { merge: true });
  } catch (err) {
    console.warn('[Sync] syncBlockToCloud failed:', err);
  }
}

/**
 * Helper to delete a single timetable block from Cloud Firestore
 */
export async function deleteBlockFromCloud(uid: string, blockId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !uid) return;
  try {
    const blockRef = doc(db, 'users', uid, 'timetableBlocks', blockId);
    await deleteDoc(blockRef);
  } catch (err) {
    console.warn('[Sync] deleteBlockFromCloud failed:', err);
  }
}
