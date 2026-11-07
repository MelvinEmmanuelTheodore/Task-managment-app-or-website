import { StoredDataEnvelope } from '../types/storage';
import { Category } from '../types/category';
import { Topic } from '../types/topic';
import { TopicTask } from '../types/topicTask';
import { TimetableBlock } from '../types/timetable';
import { UserSettings } from '../types/settings';
import { AppTimestamp } from '../types/task';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  envelope?: StoredDataEnvelope;
}

export function isValidTimestamp(ts: any): ts is AppTimestamp {
  return (
    typeof ts === 'object' &&
    ts !== null &&
    typeof ts.seconds === 'number' &&
    !isNaN(ts.seconds) &&
    typeof ts.nanoseconds === 'number' &&
    !isNaN(ts.nanoseconds)
  );
}

/**
 * Validates a full backup payload for envelope integrity, data types, duplicate IDs,
 * and parent-child referential integrity.
 */
export function validateBackupPayload(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { isValid: false, errors: ['Backup payload must be a non-null JSON object'] };
  }

  const payload = raw as Record<string, any>;

  // 1. Schema Version
  if (typeof payload.schemaVersion !== 'number') {
    errors.push('Missing or invalid "schemaVersion" field (expected number)');
  } else if (![1, 2].includes(payload.schemaVersion)) {
    errors.push(`Unsupported schema version ${payload.schemaVersion} (expected 1 or 2)`);
  }

  // 2. Categories
  if (!Array.isArray(payload.categories)) {
    errors.push('"categories" must be an array');
  } else {
    const categoryIds = new Set<string>();
    payload.categories.forEach((cat: any, index: number) => {
      const prefix = `Category [${index}]`;
      if (!cat || typeof cat !== 'object') {
        errors.push(`${prefix} is not a valid object`);
        return;
      }
      if (typeof cat.id !== 'string' || !cat.id.trim()) {
        errors.push(`${prefix} missing valid id`);
      } else if (categoryIds.has(cat.id)) {
        errors.push(`${prefix} has duplicate id "${cat.id}"`);
      } else {
        categoryIds.add(cat.id);
      }
      if (typeof cat.name !== 'string' || !cat.name.trim()) errors.push(`${prefix} missing valid name`);
      if (!['high', 'medium', 'low'].includes(cat.priority)) errors.push(`${prefix} invalid priority`);
      if (typeof cat.sortOrder !== 'number') errors.push(`${prefix} invalid sortOrder`);
      if (typeof cat.color !== 'string') errors.push(`${prefix} invalid color`);
      if (!isValidTimestamp(cat.createdAt)) errors.push(`${prefix} invalid createdAt timestamp`);
      if (!isValidTimestamp(cat.updatedAt)) errors.push(`${prefix} invalid updatedAt timestamp`);
    });
  }

  // 3. Topics
  if (!Array.isArray(payload.topics)) {
    errors.push('"topics" must be an array');
  } else {
    const topicIds = new Set<string>();
    const categoryIds = new Set<string>(
      Array.isArray(payload.categories) ? payload.categories.map((c: any) => c.id).filter(Boolean) : []
    );

    payload.topics.forEach((topic: any, index: number) => {
      const prefix = `Topic [${index}]`;
      if (!topic || typeof topic !== 'object') {
        errors.push(`${prefix} is not a valid object`);
        return;
      }
      if (typeof topic.id !== 'string' || !topic.id.trim()) {
        errors.push(`${prefix} missing valid id`);
      } else if (topicIds.has(topic.id)) {
        errors.push(`${prefix} has duplicate id "${topic.id}"`);
      } else {
        topicIds.add(topic.id);
      }
      if (!categoryIds.has(topic.categoryId)) {
        errors.push(`${prefix} references missing categoryId "${topic.categoryId}"`);
      }
      if (typeof topic.name !== 'string' || !topic.name.trim()) errors.push(`${prefix} missing valid name`);
      if (!['high', 'medium', 'low'].includes(topic.priority)) errors.push(`${prefix} invalid priority`);
      if (typeof topic.sortOrder !== 'number') errors.push(`${prefix} invalid sortOrder`);
      if (typeof topic.isActive !== 'boolean') errors.push(`${prefix} invalid isActive`);
      if (!isValidTimestamp(topic.createdAt)) errors.push(`${prefix} invalid createdAt timestamp`);
      if (!isValidTimestamp(topic.updatedAt)) errors.push(`${prefix} invalid updatedAt timestamp`);
    });
  }

  // 4. Topic Tasks
  if (!Array.isArray(payload.topicTasks)) {
    errors.push('"topicTasks" must be an array');
  } else {
    const taskIds = new Set<string>();
    const topicIds = new Set<string>(
      Array.isArray(payload.topics) ? payload.topics.map((t: any) => t.id).filter(Boolean) : []
    );

    payload.topicTasks.forEach((task: any, index: number) => {
      const prefix = `TopicTask [${index}]`;
      if (!task || typeof task !== 'object') {
        errors.push(`${prefix} is not a valid object`);
        return;
      }
      if (typeof task.id !== 'string' || !task.id.trim()) {
        errors.push(`${prefix} missing valid id`);
      } else if (taskIds.has(task.id)) {
        errors.push(`${prefix} has duplicate id "${task.id}"`);
      } else {
        taskIds.add(task.id);
      }
      if (!topicIds.has(task.topicId)) {
        errors.push(`${prefix} references missing topicId "${task.topicId}"`);
      }
      if (typeof task.title !== 'string' || !task.title.trim()) errors.push(`${prefix} missing valid title`);
      if (typeof task.isCompleted !== 'boolean') errors.push(`${prefix} invalid isCompleted`);
      if (!isValidTimestamp(task.createdAt)) errors.push(`${prefix} invalid createdAt timestamp`);
      if (!isValidTimestamp(task.updatedAt)) errors.push(`${prefix} invalid updatedAt timestamp`);
    });
  }

  // 5. Timetable Blocks
  if (!Array.isArray(payload.timetableBlocks)) {
    errors.push('"timetableBlocks" must be an array');
  } else {
    const blockIds = new Set<string>();
    const categoryIds = new Set<string>(
      Array.isArray(payload.categories) ? payload.categories.map((c: any) => c.id).filter(Boolean) : []
    );

    payload.timetableBlocks.forEach((block: any, index: number) => {
      const prefix = `TimetableBlock [${index}]`;
      if (!block || typeof block !== 'object') {
        errors.push(`${prefix} is not a valid object`);
        return;
      }
      if (typeof block.id !== 'string' || !block.id.trim()) {
        errors.push(`${prefix} missing valid id`);
      } else if (blockIds.has(block.id)) {
        errors.push(`${prefix} has duplicate id "${block.id}"`);
      } else {
        blockIds.add(block.id);
      }
      if (!categoryIds.has(block.categoryId)) {
        errors.push(`${prefix} references missing categoryId "${block.categoryId}"`);
      }
      if (typeof block.startTime !== 'string' || !block.startTime.match(/^\d{2}:\d{2}$/)) {
        errors.push(`${prefix} invalid startTime (expected HH:mm)`);
      }
      if (typeof block.endTime !== 'string' || !block.endTime.match(/^\d{2}:\d{2}$/)) {
        errors.push(`${prefix} invalid endTime (expected HH:mm)`);
      }
      if (typeof block.dayOfWeek !== 'number' || block.dayOfWeek < 0 || block.dayOfWeek > 6) {
        errors.push(`${prefix} invalid dayOfWeek (0-6)`);
      }
      if (typeof block.isFixed !== 'boolean') errors.push(`${prefix} invalid isFixed`);
      if (!isValidTimestamp(block.createdAt)) errors.push(`${prefix} invalid createdAt timestamp`);
      if (!isValidTimestamp(block.updatedAt)) errors.push(`${prefix} invalid updatedAt timestamp`);
    });
  }

  // 6. Settings
  if (typeof payload.settings !== 'object' || payload.settings === null) {
    errors.push('"settings" must be a valid object');
  } else {
    const s = payload.settings;
    if (typeof s.defaultReminderMinutesBefore !== 'number') errors.push('settings.defaultReminderMinutesBefore must be a number');
    if (!['light', 'dark', 'system'].includes(s.theme)) errors.push('settings.theme must be "light" | "dark" | "system"');
    if (typeof s.wakeUpTime !== 'string') errors.push('settings.wakeUpTime must be a string');
    if (typeof s.windDownTime !== 'string') errors.push('settings.windDownTime must be a string');
    if (typeof s.batteryOptimizationDismissed !== 'boolean') errors.push('settings.batteryOptimizationDismissed must be boolean');
    if (!isValidTimestamp(s.createdAt)) errors.push('settings.createdAt must be valid timestamp');
    if (!isValidTimestamp(s.updatedAt)) errors.push('settings.updatedAt must be valid timestamp');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    envelope: payload as StoredDataEnvelope,
  };
}

/**
 * Compares two AppTimestamps (seconds + nanoseconds).
 * Returns true if timestamp A is strictly newer than timestamp B.
 */
export function isTimestampNewer(a: AppTimestamp, b: AppTimestamp): boolean {
  if (a.seconds > b.seconds) return true;
  if (a.seconds < b.seconds) return false;
  return a.nanoseconds > b.nanoseconds;
}

/**
 * Deterministically merges an incoming backup envelope into local data.
 * - Same ID represents the same logical record.
 * - Newer updatedAt wins (comparing both seconds and nanoseconds).
 * - Equal timestamps retain existing local record.
 * - Completely idempotent.
 */
export function mergeBackupEnvelopes(
  local: StoredDataEnvelope,
  incoming: StoredDataEnvelope
): StoredDataEnvelope {
  // Helper to merge entity maps
  function mergeCollections<T extends { id: string; updatedAt: AppTimestamp }>(
    localList: T[],
    incomingList: T[]
  ): T[] {
    const map = new Map<string, T>();
    // Seed with local items
    for (const item of localList) {
      map.set(item.id, item);
    }
    // Compare incoming items
    for (const incomingItem of incomingList) {
      const existing = map.get(incomingItem.id);
      if (!existing) {
        map.set(incomingItem.id, incomingItem);
      } else {
        if (isTimestampNewer(incomingItem.updatedAt, existing.updatedAt)) {
          map.set(incomingItem.id, incomingItem);
        }
        // Equal timestamps or incoming older: retain existing local item
      }
    }
    return Array.from(map.values());
  }

  const mergedCategories = mergeCollections<Category>(local.categories, incoming.categories);
  const mergedTopics = mergeCollections<Topic>(local.topics, incoming.topics);
  const mergedTopicTasks = mergeCollections<TopicTask>(local.topicTasks, incoming.topicTasks);
  const mergedTimetableBlocks = mergeCollections<TimetableBlock>(local.timetableBlocks, incoming.timetableBlocks);

  // Settings merge: newer updatedAt wins, equal retains local
  let mergedSettings = local.settings;
  if (isTimestampNewer(incoming.settings.updatedAt, local.settings.updatedAt)) {
    mergedSettings = incoming.settings;
  }

  return {
    schemaVersion: 1,
    categories: mergedCategories,
    topics: mergedTopics,
    topicTasks: mergedTopicTasks,
    timetableBlocks: mergedTimetableBlocks,
    settings: mergedSettings,
  };
}
