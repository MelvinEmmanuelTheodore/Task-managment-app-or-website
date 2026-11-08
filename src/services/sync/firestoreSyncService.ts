import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../firebase/webFirebase';
import { getStorage } from '../storage';
import { useTimetableStore } from '../../stores/timetableStore';
import { useCategoryTopicStore } from '../../stores/categoryTopicStore';
import { TimetableBlock } from '../../types/timetable';
import { Category } from '../../types/category';
import { Topic } from '../../types/topic';
import { TopicTask } from '../../types/topicTask';

let activeUnsubscribes: Unsubscribe[] = [];

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
 * Upload all current local data (blocks, categories, topics, tasks) to Firestore in atomic batches.
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

  const envelope = await getStorage().loadAll();
  const { timetableBlocks, categories, topics, topicTasks } = envelope;

  const batch = writeBatch(db);

  // 1. Timetable Blocks
  for (const block of timetableBlocks) {
    const blockRef = doc(db, 'users', uid, 'timetableBlocks', block.id);
    batch.set(blockRef, block, { merge: true });
  }

  // 2. Categories
  for (const cat of categories) {
    const catRef = doc(db, 'users', uid, 'categories', cat.id);
    batch.set(catRef, cat, { merge: true });
  }

  // 3. Topics
  for (const top of topics) {
    const topRef = doc(db, 'users', uid, 'topics', top.id);
    batch.set(topRef, top, { merge: true });
  }

  // 4. Tasks
  for (const t of topicTasks) {
    const taskRef = doc(db, 'users', uid, 'topicTasks', t.id);
    batch.set(taskRef, t, { merge: true });
  }

  await batch.commit();

  return {
    blocksCount: timetableBlocks.length,
    categoriesCount: categories.length,
    topicsCount: topics.length,
    tasksCount: topicTasks.length,
  };
}

/**
 * Start real-time Firestore synchronization for a signed-in user.
 * Pulls down remote changes and keeps local storage + stores updated.
 */
export function startFirestoreSync(uid: string): () => void {
  stopFirestoreSync(); // Clean up existing listeners

  const db = getFirestoreDb();
  if (!db || !uid || !isFirebaseConfigured()) {
    return () => {};
  }

  // 1. Timetable Blocks Listener
  const blocksCol = collection(db, 'users', uid, 'timetableBlocks');
  const unsubBlocks = onSnapshot(
    blocksCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;
      const remoteBlocks: TimetableBlock[] = [];
      snapshot.forEach((docSnap) => {
        remoteBlocks.push(docSnap.data() as TimetableBlock);
      });

      if (remoteBlocks.length > 0) {
        // Save to local storage adapter
        for (const b of remoteBlocks) {
          await getStorage().saveTimetableBlock(b);
        }
        // Update timetable store
        useTimetableStore.getState().setBlocksFromEnvelope(remoteBlocks);
      }
    },
    (err) => console.warn('[Sync] Blocks listener warning:', err)
  );
  activeUnsubscribes.push(unsubBlocks);

  // 2. Categories Listener
  const catsCol = collection(db, 'users', uid, 'categories');
  const unsubCats = onSnapshot(
    catsCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;
      const remoteCats: Category[] = [];
      snapshot.forEach((docSnap) => {
        remoteCats.push(docSnap.data() as Category);
      });

      if (remoteCats.length > 0) {
        for (const c of remoteCats) {
          await getStorage().saveCategory(c);
        }
        await useCategoryTopicStore.getState().loadInitialData();
      }
    },
    (err) => console.warn('[Sync] Categories listener warning:', err)
  );
  activeUnsubscribes.push(unsubCats);

  // 3. Topics Listener
  const topicsCol = collection(db, 'users', uid, 'topics');
  const unsubTopics = onSnapshot(
    topicsCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;
      const remoteTopics: Topic[] = [];
      snapshot.forEach((docSnap) => {
        remoteTopics.push(docSnap.data() as Topic);
      });

      if (remoteTopics.length > 0) {
        for (const t of remoteTopics) {
          await getStorage().saveTopic(t);
        }
        await useCategoryTopicStore.getState().loadInitialData();
      }
    },
    (err) => console.warn('[Sync] Topics listener warning:', err)
  );
  activeUnsubscribes.push(unsubTopics);

  // 4. Tasks Listener
  const tasksCol = collection(db, 'users', uid, 'topicTasks');
  const unsubTasks = onSnapshot(
    tasksCol,
    async (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;
      const remoteTasks: TopicTask[] = [];
      snapshot.forEach((docSnap) => {
        remoteTasks.push(docSnap.data() as TopicTask);
      });

      if (remoteTasks.length > 0) {
        for (const task of remoteTasks) {
          await getStorage().saveTopicTask(task);
        }
        await useCategoryTopicStore.getState().loadInitialData();
      }
    },
    (err) => console.warn('[Sync] Tasks listener warning:', err)
  );
  activeUnsubscribes.push(unsubTasks);

  return stopFirestoreSync;
}

/**
 * Stop all active Firestore real-time listeners
 */
export function stopFirestoreSync(): void {
  for (const unsub of activeUnsubscribes) {
    try {
      unsub();
    } catch {}
  }
  activeUnsubscribes = [];
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
