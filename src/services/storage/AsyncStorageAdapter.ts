import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorageAdapter } from './IStorageAdapter';
import { StoredDataEnvelope } from '../../types/storage';
import { Category } from '../../types/category';
import { Topic } from '../../types/topic';
import { TopicTask } from '../../types/topicTask';
import { TimetableBlock } from '../../types/timetable';
import { UserSettings } from '../../types/settings';
import { DEFAULT_CATEGORIES, DEFAULT_TOPICS } from '../../constants/defaultData';
import { dateToAppTimestamp } from '../../utils/dateHelpers';
import { validateBackupPayload, mergeBackupEnvelopes } from '../../utils/backupValidator';

export const STORAGE_KEY = '@time_mgmt_app_data_v1';
export const RECOVERY_KEY_PREFIX = '@time_mgmt_app_data_recovery_';
export const PRE_MIGRATION_KEY_PREFIX = '@time_mgmt_pre_migration_v1_';
export const SNAPSHOT_KEY_PREFIX = '@time_mgmt_internal_rollback_snapshot_';
export const CURRENT_SCHEMA_VERSION = 1;

export type MigrationStep = (data: any) => any;

/**
 * Sequential migration functions registry: v1 -> v2, v2 -> v3, etc.
 */
export const MIGRATIONS: Record<number, MigrationStep> = {
  1: (v1Data: StoredDataEnvelope) => {
    return {
      ...v1Data,
      schemaVersion: 2,
    };
  },
};

export class AsyncStorageAdapter implements IStorageAdapter {
  private writeQueue: Promise<void> = Promise.resolve();
  private isLocked = false;
  private corruptionError: string | null = null;
  private inMemoryRawCorruptedPayload: string | null = null;

  isStorageLocked(): boolean {
    return this.isLocked;
  }

  getCorruptionError(): string | null {
    return this.corruptionError;
  }

  getRawCorruptedPayload(): string | null {
    return this.inMemoryRawCorruptedPayload;
  }

  /**
   * Retries writing the in-memory raw corrupted payload to the recovery key.
   * Useful when an earlier recovery-copy write failed due to transient storage errors.
   */
  async retryRecovery(): Promise<boolean> {
    if (!this.inMemoryRawCorruptedPayload) {
      return false;
    }
    try {
      const recoveryKey = `${RECOVERY_KEY_PREFIX}${Date.now()}`;
      await AsyncStorage.setItem(recoveryKey, this.inMemoryRawCorruptedPayload);
      return true;
    } catch {
      return false;
    }
  }

  /** Emergency / test reset for locked storage */
  clearLock(): void {
    this.isLocked = false;
    this.corruptionError = null;
    this.inMemoryRawCorruptedPayload = null;
  }

  private getInitialData(): StoredDataEnvelope {
    const now = dateToAppTimestamp(new Date());
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      // Deep copy default collections so module constants are never mutated
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      topics: JSON.parse(JSON.stringify(DEFAULT_TOPICS)),
      topicTasks: [],
      timetableBlocks: [],
      settings: {
        defaultReminderMinutesBefore: 5,
        theme: 'dark',
        wakeUpTime: '08:00',
        windDownTime: '22:45',
        batteryOptimizationDismissed: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /**
   * Empty fallback envelope returned when storage is locked.
   * Prevents presenting seeded defaults as if they were the user's actual data.
   */
  private getLockedEmptyData(): StoredDataEnvelope {
    const now = dateToAppTimestamp(new Date());
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      categories: [],
      topics: [],
      topicTasks: [],
      timetableBlocks: [],
      settings: {
        defaultReminderMinutesBefore: 5,
        theme: 'dark',
        wakeUpTime: '08:00',
        windDownTime: '22:45',
        batteryOptimizationDismissed: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /** Serialized write queue to eliminate write collisions */
  private enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(() => {
          if (this.isLocked) {
            throw new Error(`Storage is locked due to data corruption: ${this.corruptionError}`);
          }
          return op();
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Handles corrupted payload or invalid envelope:
   * - Locks writes.
   * - Retains raw payload in memory.
   * - Tries to write a timestamped recovery copy.
   * - Never overwrites primary storage with defaults.
   * - Returns locked empty data.
   */
  private async handleCorruptedPayload(raw: string, reason: string): Promise<StoredDataEnvelope> {
    this.isLocked = true;
    this.corruptionError = reason;
    this.inMemoryRawCorruptedPayload = raw;

    try {
      const recoveryKey = `${RECOVERY_KEY_PREFIX}${Date.now()}`;
      await AsyncStorage.setItem(recoveryKey, raw);
    } catch {
      // If recovery copy write fails, raw is retained in memory.
      // Primary storage remains intact and locked.
    }

    return this.getLockedEmptyData();
  }

  /**
   * Internal reader with corruption detection and recovery key preservation.
   * If parsing fails or envelope structure is invalid:
   * - Preserves raw value to a timestamped recovery key.
   * - Locks writes (isLocked = true).
   * - NEVER overwrites storage with defaults.
   * - Returns empty locked envelope.
   */
  private async readOrRecover(): Promise<StoredDataEnvelope> {
    if (this.isLocked) {
      return this.getLockedEmptyData();
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Truly absent key: seed initial defaults
      const initial = this.getInitialData();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      return this.handleCorruptedPayload(raw, `Corrupted JSON payload: ${err.message}`);
    }

    // Handle valid JSON with invalid envelope structure (e.g. null, primitives, arrays)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return this.handleCorruptedPayload(raw, 'Invalid envelope structure: payload is not a JSON object');
    }

    if (typeof parsed.schemaVersion !== 'number') {
      return this.handleCorruptedPayload(raw, 'Invalid envelope structure: missing schemaVersion');
    }

    if (parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return this.handleCorruptedPayload(raw, `Unknown future schema version: ${parsed.schemaVersion}`);
    }

    // Verify required core entity collections exist
    if (
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.topics) ||
      !Array.isArray(parsed.topicTasks) ||
      !Array.isArray(parsed.timetableBlocks) ||
      typeof parsed.settings !== 'object' ||
      parsed.settings === null
    ) {
      return this.handleCorruptedPayload(raw, 'Invalid envelope structure: missing core collections or settings');
    }

    // Clean legacy settings.categories if present
    if (parsed.settings && 'categories' in parsed.settings) {
      delete parsed.settings.categories;
    }

    return parsed as StoredDataEnvelope;
  }

  /** Transactional mutation: queues read-modify-write sequentially to prevent lost updates */
  async mutateEnvelope(
    mutator: (envelope: StoredDataEnvelope) => void | Promise<void>
  ): Promise<StoredDataEnvelope> {
    return this.enqueueWrite(async () => {
      const data = await this.readOrRecover();
      if (this.isLocked) {
        throw new Error(`Cannot mutate storage: storage is locked (${this.corruptionError})`);
      }
      await mutator(data);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    });
  }

  async loadAll(): Promise<StoredDataEnvelope> {
    return this.readOrRecover();
  }

  async saveAll(envelope: StoredDataEnvelope): Promise<void> {
    return this.enqueueWrite(async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    });
  }

  async getCategories(): Promise<Category[]> {
    const data = await this.loadAll();
    return data.categories;
  }

  async saveCategory(category: Category): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.categories.findIndex((c) => c.id === category.id);
      if (index >= 0) {
        data.categories[index] = category;
      } else {
        data.categories.push(category);
      }
    });
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.categories = data.categories.filter((c) => c.id !== categoryId);
    });
  }

  async getTopics(): Promise<Topic[]> {
    const data = await this.loadAll();
    return data.topics;
  }

  async saveTopic(topic: Topic): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.topics.findIndex((t) => t.id === topic.id);
      if (index >= 0) {
        data.topics[index] = topic;
      } else {
        data.topics.push(topic);
      }
    });
  }

  async deleteTopic(topicId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.topics = data.topics.filter((t) => t.id !== topicId);
      data.topicTasks = data.topicTasks.filter((task) => task.topicId !== topicId);
    });
  }

  async getTopicTasks(): Promise<TopicTask[]> {
    const data = await this.loadAll();
    return data.topicTasks;
  }

  async saveTopicTask(task: TopicTask): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.topicTasks.findIndex((t) => t.id === task.id);
      if (index >= 0) {
        data.topicTasks[index] = task;
      } else {
        data.topicTasks.push(task);
      }
    });
  }

  async deleteTopicTask(taskId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.topicTasks = data.topicTasks.filter((t) => t.id !== taskId);
    });
  }

  async getTimetableBlocks(): Promise<TimetableBlock[]> {
    const data = await this.loadAll();
    return data.timetableBlocks;
  }

  async saveTimetableBlock(block: TimetableBlock): Promise<void> {
    await this.mutateEnvelope((data) => {
      const index = data.timetableBlocks.findIndex((b) => b.id === block.id);
      if (index >= 0) {
        data.timetableBlocks[index] = block;
      } else {
        data.timetableBlocks.push(block);
      }
    });
  }

  async deleteTimetableBlock(blockId: string): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.timetableBlocks = data.timetableBlocks.filter((b) => b.id !== blockId);
    });
  }

  async getSettings(): Promise<UserSettings> {
    const data = await this.loadAll();
    return data.settings;
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    await this.mutateEnvelope((data) => {
      data.settings = settings;
    });
  }

  async exportAllData(): Promise<string> {
    const data = await this.loadAll();
    return JSON.stringify(data, null, 2);
  }

  async importAllData(jsonString: string): Promise<StoredDataEnvelope> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format');
    }
    const validation = validateBackupPayload(parsed);
    if (!validation.isValid || !validation.envelope) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }
    return this.replaceAllData(validation.envelope);
  }

  /**
   * Creates an internal rollback snapshot before replacing all data.
   * Verifies that the snapshot was written, is non-empty, and parses as JSON.
   * Throws if verification fails.
   */
  async createRollbackSnapshot(): Promise<string> {
    const snapshotKey = `${SNAPSHOT_KEY_PREFIX}${Date.now()}`;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const contentToSnapshot = raw ?? JSON.stringify(this.getInitialData());

    await AsyncStorage.setItem(snapshotKey, contentToSnapshot);

    // Verify snapshot
    const readBack = await AsyncStorage.getItem(snapshotKey);
    if (!readBack || readBack.trim().length === 0) {
      throw new Error('Internal rollback snapshot verification failed: snapshot is empty or missing');
    }
    try {
      JSON.parse(readBack);
    } catch {
      throw new Error('Internal rollback snapshot verification failed: corrupted JSON in snapshot');
    }

    return snapshotKey;
  }

  /**
   * Deterministically merges an incoming backup envelope into existing data.
   */
  async mergeAllData(incomingEnvelope: StoredDataEnvelope): Promise<StoredDataEnvelope> {
    const validation = validateBackupPayload(incomingEnvelope);
    if (!validation.isValid || !validation.envelope) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    return this.mutateEnvelope((localData) => {
      const merged = mergeBackupEnvelopes(localData, validation.envelope!);
      localData.categories = merged.categories;
      localData.topics = merged.topics;
      localData.topicTasks = merged.topicTasks;
      localData.timetableBlocks = merged.timetableBlocks;
      localData.settings = merged.settings;
    });
  }

  /**
   * Replaces all existing data with the validated incoming envelope.
   * Strictly creates and verifies an internal rollback snapshot before replacing.
   * If snapshot creation or verification fails, aborts with zero modifications.
   */
  async replaceAllData(incomingEnvelope: StoredDataEnvelope): Promise<StoredDataEnvelope> {
    const validation = validateBackupPayload(incomingEnvelope);
    if (!validation.isValid || !validation.envelope) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    // 1. Create and verify internal rollback snapshot
    await this.createRollbackSnapshot();

    // 2. Perform replacement
    await this.saveAll(validation.envelope);
    return validation.envelope;
  }

  /**
   * Sequential schema migration mechanism:
   * 1. Preserves raw payload to a pre-migration timestamped key.
   * 2. Verifies preservation. If preservation fails, aborts with ZERO modifications to existing data.
   * 3. Runs sequential migration steps up to targetVersion.
   * 4. Saves migrated envelope to primary key.
   */
  async migrateVersion(targetVersion: number): Promise<StoredDataEnvelope> {
    return this.enqueueWrite(async () => {
      if (this.isLocked) {
        throw new Error(`Cannot run migration: storage is locked (${this.corruptionError})`);
      }

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        throw new Error('Cannot run migration: storage is empty');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Cannot run migration: stored payload is corrupted');
      }

      if (typeof parsed.schemaVersion !== 'number') {
        throw new Error('Cannot run migration: missing schemaVersion');
      }

      if (parsed.schemaVersion >= targetVersion) {
        return parsed;
      }

      // Step 1: Pre-migration preservation
      const preMigrationKey = `${PRE_MIGRATION_KEY_PREFIX}${Date.now()}`;
      try {
        await AsyncStorage.setItem(preMigrationKey, raw);
        const verified = await AsyncStorage.getItem(preMigrationKey);
        if (!verified || verified !== raw) {
          throw new Error('Pre-migration preservation verification failed: content mismatch');
        }
      } catch (preserveErr: any) {
        throw new Error(`Migration aborted: pre-migration backup failed (${preserveErr?.message})`);
      }

      // Step 2: Sequential migrations
      let currentData = parsed;
      for (let v = parsed.schemaVersion; v < targetVersion; v++) {
        const migrator = MIGRATIONS[v];
        if (!migrator) {
          throw new Error(`Missing migration step from version ${v} to ${v + 1}`);
        }
        currentData = migrator(currentData);
        currentData.schemaVersion = v + 1;
      }

      // Step 3: Write migrated data
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
      return currentData as StoredDataEnvelope;
    });
  }

  async reorderCategories(orderedIds: string[]): Promise<void> {
    const now = dateToAppTimestamp(new Date());
    await this.mutateEnvelope((data) => {
      data.categories = data.categories.map((c) => {
        const newOrder = orderedIds.indexOf(c.id);
        return newOrder >= 0 ? { ...c, sortOrder: (newOrder + 1) * 1024, updatedAt: now } : c;
      });
    });
  }

  async reorderTopics(categoryId: string, orderedIds: string[]): Promise<void> {
    const now = dateToAppTimestamp(new Date());
    await this.mutateEnvelope((data) => {
      data.topics = data.topics.map((t) => {
        if (t.categoryId !== categoryId) return t;
        const newOrder = orderedIds.indexOf(t.id);
        return newOrder >= 0 ? { ...t, sortOrder: (newOrder + 1) * 1024, updatedAt: now } : t;
      });
    });
  }

  async deleteCategoryCascade(categoryId: string): Promise<StoredDataEnvelope> {
    return this.mutateEnvelope((data) => {
      const topicIdsToDelete = new Set(
        data.topics.filter((t) => t.categoryId === categoryId).map((t) => t.id)
      );
      data.categories = data.categories.filter((c) => c.id !== categoryId);
      data.topics = data.topics.filter((t) => t.categoryId !== categoryId);
      data.topicTasks = data.topicTasks.filter((task) => !topicIdsToDelete.has(task.topicId));
      data.timetableBlocks = data.timetableBlocks.filter((b) => b.categoryId !== categoryId);
    });
  }

  async moveCategoryContentsAndDelete(fromCategoryId: string, toCategoryId: string): Promise<StoredDataEnvelope> {
    const now = dateToAppTimestamp(new Date());
    return this.mutateEnvelope((data) => {
      data.topics = data.topics.map((t) =>
        t.categoryId === fromCategoryId ? { ...t, categoryId: toCategoryId, updatedAt: now } : t
      );
      data.timetableBlocks = data.timetableBlocks.map((b) =>
        b.categoryId === fromCategoryId ? { ...b, categoryId: toCategoryId, updatedAt: now } : b
      );
      data.categories = data.categories.filter((c) => c.id !== fromCategoryId);
    });
  }
}

export const storageAdapter: IStorageAdapter = new AsyncStorageAdapter();
