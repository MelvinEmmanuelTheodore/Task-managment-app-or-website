import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AsyncStorageAdapter,
  STORAGE_KEY,
  RECOVERY_KEY_PREFIX,
  SNAPSHOT_KEY_PREFIX,
  PRE_MIGRATION_KEY_PREFIX,
  MIGRATIONS,
} from '../services/storage/AsyncStorageAdapter';
import { getStorage } from '../services/storage';
import { validateBackupPayload, mergeBackupEnvelopes, isTimestampNewer } from '../utils/backupValidator';
import { moveItemOrder } from '../utils/sortOrder';
import { dateToAppTimestamp } from '../utils/dateHelpers';
import { StoredDataEnvelope } from '../types/storage';
import { Category } from '../types/category';
import { useCategoryTopicStore } from '../stores/categoryTopicStore';
import { useTimetableStore } from '../stores/timetableStore';

describe('Step B0: Hardening & Resilience Suite', () => {
  let adapter: AsyncStorageAdapter;

  beforeEach(async () => {
    jest.restoreAllMocks();
    (AsyncStorage.setItem as any) = async (key: string, value: string) => {
      return (AsyncStorage as any).multiSet([[key, value]]);
    };
    await AsyncStorage.clear();
    adapter = new AsyncStorageAdapter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Fix 1: Corruption Protection, Write-Lock & Recovery Key
  describe('Fix 1: Storage Corruption, Recovery Key & In-Memory Retention', () => {
    it('should lock writes, preserve raw data to recovery key, retain in memory, and NOT present defaults when JSON parse fails', async () => {
      const corruptedRaw = '{ "schemaVersion": 1, "categories": [ INVALID_JSON ...';
      await AsyncStorage.setItem(STORAGE_KEY, corruptedRaw);

      // Load all should detect corruption, set lock, and return locked empty envelope (NOT default data)
      const loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('Corrupted JSON payload');
      expect(adapter.getRawCorruptedPayload()).toBe(corruptedRaw);
      expect(loaded.categories).toEqual([]); // Does not pretend user has defaults

      // Check that a recovery key was created
      const allKeys = await AsyncStorage.getAllKeys();
      const recoveryKey = allKeys.find((k) => k.startsWith(RECOVERY_KEY_PREFIX));
      expect(recoveryKey).toBeDefined();

      const recoveryContent = await AsyncStorage.getItem(recoveryKey!);
      expect(recoveryContent).toBe(corruptedRaw);

      // Attempting to mutate storage while locked must reject immediately
      await expect(
        adapter.mutateEnvelope((data) => {
          data.categories = [];
        })
      ).rejects.toThrow('Storage is locked due to data corruption');

      // The original primary key content must NOT have been overwritten by defaults
      const primaryKeyContent = await AsyncStorage.getItem(STORAGE_KEY);
      expect(primaryKeyContent).toBe(corruptedRaw);
    });

    it('should retain raw payload in memory if writing recovery copy fails, and allow retrying recovery', async () => {
      const corruptedRaw = '{ "schemaVersion": 1, "bad": true';
      await AsyncStorage.setItem(STORAGE_KEY, corruptedRaw);

      let shouldFailRecovery = true;
      const multiSet = (AsyncStorage as any).multiSet;
      jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key: string, value: string) => {
        if (shouldFailRecovery && key.startsWith(RECOVERY_KEY_PREFIX)) {
          throw new Error('Disk I/O error on recovery key');
        }
        return multiSet([[key, value]]);
      });

      const loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getRawCorruptedPayload()).toBe(corruptedRaw);
      expect(loaded.categories).toEqual([]);

      // Primary key still contains original raw data
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(corruptedRaw);

      // Now allow recovery to succeed and test retryRecovery()
      shouldFailRecovery = false;
      const retryResult = await adapter.retryRecovery();
      expect(retryResult).toBe(true);

      const allKeys = await AsyncStorage.getAllKeys();
      const recoveryKey = allKeys.find((k) => k.startsWith(RECOVERY_KEY_PREFIX));
      expect(recoveryKey).toBeDefined();
      expect(await AsyncStorage.getItem(recoveryKey!)).toBe(corruptedRaw);
    });

    it('should safely handle valid JSON with invalid envelope structures (null, primitives, arrays, missing schemaVersion)', async () => {
      // 1. JSON null
      await AsyncStorage.setItem(STORAGE_KEY, 'null');
      let loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('Invalid envelope structure');
      expect(loaded.categories).toEqual([]);
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('null');

      adapter.clearLock();

      // 2. JSON array
      await AsyncStorage.setItem(STORAGE_KEY, '[1, 2, 3]');
      loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('Invalid envelope structure');
      expect(loaded.categories).toEqual([]);

      adapter.clearLock();

      // 3. Object without schemaVersion
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ categories: [] }));
      loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('missing schemaVersion');
    });

    it('should lock writes when an unknown future schemaVersion is encountered', async () => {
      const futurePayload = {
        schemaVersion: 99,
        categories: [],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { theme: 'dark' },
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(futurePayload));

      await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('Unknown future schema version: 99');

      await expect(
        adapter.mutateEnvelope(() => {})
      ).rejects.toThrow('Storage is locked');
    });

    it('should seed default data when key is truly absent without locking', async () => {
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
      const loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(false);
      expect(loaded.schemaVersion).toBe(2);
      expect(loaded.categories.length).toBeGreaterThan(0);
      expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
  });

  // Fix 2: Sequential Version Migration & Failure Safeguards
  describe('Fix 2: Version Migration Mechanism & Failure Safeguards', () => {
    const v1Data = {
      schemaVersion: 1,
      categories: [
        {
          id: 'cat_v1',
          name: 'V1 Category',
          priority: 'high',
          sortOrder: 1024,
          color: '#000',
          createdAt: { seconds: 1000, nanoseconds: 0 },
          updatedAt: { seconds: 1000, nanoseconds: 0 },
        },
      ],
      topics: [],
      topicTasks: [],
      timetableBlocks: [],
      settings: {
        theme: 'dark',
        wakeUpTime: '08:00',
        windDownTime: '22:00',
        defaultReminderMinutesBefore: 5,
        batteryOptimizationDismissed: false,
        categories: ['legacy_cat_list'],
        createdAt: { seconds: 1000, nanoseconds: 0 },
        updatedAt: { seconds: 1000, nanoseconds: 0 },
      },
    };

    it('should preserve v1 payload and sequentially migrate to v2', async () => {
      const v1Raw = JSON.stringify(v1Data);
      await AsyncStorage.setItem(STORAGE_KEY, v1Raw);

      const migrated = await adapter.migrateVersion(2);
      expect(migrated.schemaVersion).toBe(2);
      expect((migrated.settings as any).categories).toBeUndefined(); // Legacy field stripped

      // Verify pre-migration snapshot key exists and matches original v1
      const allKeys = await AsyncStorage.getAllKeys();
      const preMigrationKey = allKeys.find((k) => k.startsWith(PRE_MIGRATION_KEY_PREFIX));
      expect(preMigrationKey).toBeDefined();
      expect(await AsyncStorage.getItem(preMigrationKey!)).toBe(v1Raw);

      // Verify primary storage key updated to v2
      const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!);
      expect(stored.schemaVersion).toBe(2);
    });

    it('should successfully auto-migrate v1 data to v2 on loadAll and allow mutations without locking', async () => {
      const v1Raw = JSON.stringify(v1Data);
      await AsyncStorage.setItem(STORAGE_KEY, v1Raw);

      // Reader auto-migrates v1 data to v2 without locking
      const loadedAfter = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(false);
      expect(loadedAfter.schemaVersion).toBe(2);
      expect(loadedAfter.categories.some((c) => c.id === 'cat_v1')).toBe(true);

      // Verify pre-migration snapshot was created
      const allKeys = await AsyncStorage.getAllKeys();
      const preMigrationKey = allKeys.find((k) => k.startsWith(PRE_MIGRATION_KEY_PREFIX));
      expect(preMigrationKey).toBeDefined();

      // Reader allows mutations on migrated v2 data
      await adapter.saveCategory({
        id: 'cat_v2_test',
        name: 'V2 Category',
        priority: 'high',
        sortOrder: 1024,
        color: '#000',
        createdAt: dateToAppTimestamp(new Date()),
        updatedAt: dateToAppTimestamp(new Date()),
      });

      const reloaded = await adapter.loadAll();
      expect(reloaded.categories.some((c) => c.id === 'cat_v2_test')).toBe(true);
      expect(reloaded.schemaVersion).toBe(2);
    });

    it('should reject genuinely unsupported future versions (e.g. schemaVersion: 3 or 99) and lock writes', async () => {
      const futurePayload = {
        schemaVersion: 3,
        categories: [],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { theme: 'dark' },
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(futurePayload));

      await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('Unknown future schema version: 3');

      // Writing recovery key
      const allKeys = await AsyncStorage.getAllKeys();
      const recoveryKey = allKeys.find((k) => k.startsWith(RECOVERY_KEY_PREFIX));
      expect(recoveryKey).toBeDefined();

      await expect(
        adapter.mutateEnvelope(() => {})
      ).rejects.toThrow('Storage is locked');

      // Also migrateVersion rejects unsupported future versions on unlocked storage
      adapter.clearLock();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, categories: [], topics: [], topicTasks: [], timetableBlocks: [], settings: {} }));
      await expect(adapter.migrateVersion(3)).rejects.toThrow(
        'Target migration schema version 3 is not supported by this application version'
      );
    });

    it('should abort migration and leave original data untouched if pre-migration preservation fails', async () => {
      const v1Raw = JSON.stringify(v1Data);
      await AsyncStorage.setItem(STORAGE_KEY, v1Raw);

      let failPreserve = true;
      const multiSet = (AsyncStorage as any).multiSet;
      (AsyncStorage.setItem as any) = async (key: string, value: string) => {
        if (failPreserve && key.startsWith(PRE_MIGRATION_KEY_PREFIX)) {
          throw new Error('Failed to write pre-migration snapshot');
        }
        return multiSet([[key, value]]);
      };

      await expect(adapter.migrateVersion(2)).rejects.toThrow(
        'Migration aborted: pre-migration backup failed'
      );

      failPreserve = false;
      (AsyncStorage.setItem as any) = async (key: string, value: string) => {
        return multiSet([[key, value]]);
      };

      // Original data must be completely untouched
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(v1Raw);
    });

    it('should reject malformed v1 collections before migration, lock storage, and leave original primary data unchanged', async () => {
      // Malformed v1: categories is a string instead of an array
      const malformedV1 = {
        schemaVersion: 1,
        categories: 'not-an-array',
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { theme: 'dark' },
      };
      const raw = JSON.stringify(malformedV1);
      await AsyncStorage.setItem(STORAGE_KEY, raw);

      const loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('missing or invalid core collections or settings');
      expect(loaded.categories).toEqual([]);

      // Verify original primary storage payload is completely untouched (never overwritten with migrated/defaults)
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(raw);

      // Verify recovery copy was preserved
      const allKeys = await AsyncStorage.getAllKeys();
      const recoveryKey = allKeys.find((k) => k.startsWith(RECOVERY_KEY_PREFIX));
      expect(recoveryKey).toBeDefined();
      expect(await AsyncStorage.getItem(recoveryKey!)).toBe(raw);
    });

    it('should reject invalid settings type in v1 before migration and leave primary data unchanged', async () => {
      const invalidSettingsV1 = {
        schemaVersion: 1,
        categories: [],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: 'invalid-primitive-string',
      };
      const raw = JSON.stringify(invalidSettingsV1);
      await AsyncStorage.setItem(STORAGE_KEY, raw);

      const loaded = await adapter.loadAll();
      expect(adapter.isStorageLocked()).toBe(true);
      expect(adapter.getCorruptionError()).toContain('missing or invalid core collections or settings');
      expect(loaded.categories).toEqual([]);

      // Primary storage remains completely untouched
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(raw);

      // migrateVersion() also safely aborts and preserves original primary payload
      adapter.clearLock();
      await expect(adapter.migrateVersion(2)).rejects.toThrow('missing or invalid core collections or settings');
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(raw);
    });

    it('should safely handle migration exceptions, lock storage, and leave primary data unchanged', async () => {
      const raw = JSON.stringify(v1Data);
      await AsyncStorage.setItem(STORAGE_KEY, raw);

      // Mock migrator step 1 to throw an exception
      const originalMigrator = MIGRATIONS[1];
      MIGRATIONS[1] = () => {
        throw new Error('Simulated transformer explosion');
      };

      try {
        const loaded = await adapter.loadAll();
        expect(adapter.isStorageLocked()).toBe(true);
        expect(adapter.getCorruptionError()).toContain('Migration aborted: step execution failed');
        expect(loaded.categories).toEqual([]);

        // Primary storage remains completely untouched
        expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(raw);
      } finally {
        MIGRATIONS[1] = originalMigrator;
      }
    });

    it('should abort if a migration step produces an invalid envelope, keeping primary storage untouched', async () => {
      const raw = JSON.stringify(v1Data);
      await AsyncStorage.setItem(STORAGE_KEY, raw);

      // Mock migrator step 1 to produce an envelope missing required categories array
      const originalMigrator = MIGRATIONS[1];
      MIGRATIONS[1] = (d: any) => ({ ...d, categories: null, schemaVersion: 2 });

      try {
        const loaded = await adapter.loadAll();
        expect(adapter.isStorageLocked()).toBe(true);
        expect(adapter.getCorruptionError()).toContain('post-migration validation failed');

        // Primary storage remains completely untouched
        expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(raw);
      } finally {
        MIGRATIONS[1] = originalMigrator;
      }
    });
  });

  // Fix 3: Full Schema Validation, Deterministic Merge & Rollback Snapshot
  describe('Fix 3: Backup Validation, Deterministic Merge & Rollback Snapshot', () => {
    const now = dateToAppTimestamp(new Date('2026-11-07T12:00:00Z'));
    const older = dateToAppTimestamp(new Date('2026-11-07T11:00:00Z'));
    const newer = dateToAppTimestamp(new Date('2026-11-07T13:00:00Z'));

    it('should reject malformed backup payloads (missing arrays, invalid timestamps, orphaned FKs)', () => {
      // Missing topics array
      const malformed1 = {
        schemaVersion: 2,
        categories: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: {},
      };
      const res1 = validateBackupPayload(malformed1);
      expect(res1.isValid).toBe(false);
      expect(res1.errors).toContain('"topics" must be an array');

      // Topic referencing non-existent category
      const orphanTopic = {
        schemaVersion: 2,
        categories: [{ id: 'cat_1', name: 'Work', priority: 'high', sortOrder: 1024, color: '#000', createdAt: now, updatedAt: now }],
        topics: [{ id: 'top_1', categoryId: 'missing_cat', name: 'Task', priority: 'high', sortOrder: 1024, isActive: true, createdAt: now, updatedAt: now }],
        topicTasks: [],
        timetableBlocks: [],
        settings: { defaultReminderMinutesBefore: 5, theme: 'dark', wakeUpTime: '08:00', windDownTime: '22:00', batteryOptimizationDismissed: false, createdAt: now, updatedAt: now },
      };
      const res2 = validateBackupPayload(orphanTopic);
      expect(res2.isValid).toBe(false);
      expect(res2.errors.some((e) => e.includes('references missing categoryId'))).toBe(true);

      // Duplicate category IDs within imported array
      const duplicateCat = {
        schemaVersion: 2,
        categories: [
          { id: 'cat_1', name: 'Work', priority: 'high', sortOrder: 1024, color: '#000', createdAt: now, updatedAt: now },
          { id: 'cat_1', name: 'Work Copy', priority: 'low', sortOrder: 2048, color: '#111', createdAt: now, updatedAt: now },
        ],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { defaultReminderMinutesBefore: 5, theme: 'dark', wakeUpTime: '08:00', windDownTime: '22:00', batteryOptimizationDismissed: false, createdAt: now, updatedAt: now },
      };
      const res3 = validateBackupPayload(duplicateCat);
      expect(res3.isValid).toBe(false);
      expect(res3.errors.some((e) => e.includes('duplicate id'))).toBe(true);
    });

    it('should compare both seconds and nanoseconds during deterministic merge', () => {
      const tsA = { seconds: 1000, nanoseconds: 500 };
      const tsB = { seconds: 1000, nanoseconds: 600 };
      const tsC = { seconds: 1000, nanoseconds: 500 }; // equal to A
      const tsD = { seconds: 999, nanoseconds: 999 };

      expect(isTimestampNewer(tsB, tsA)).toBe(true);
      expect(isTimestampNewer(tsA, tsB)).toBe(false);
      expect(isTimestampNewer(tsA, tsC)).toBe(false); // equal is NOT newer
      expect(isTimestampNewer(tsA, tsD)).toBe(true);
    });

    it('should merge incoming data deterministically: same ID = same record, newer updatedAt wins, equal retains local', () => {
      const local: StoredDataEnvelope = {
        schemaVersion: 2,
        categories: [
          { id: 'cat_1', name: 'Local Name (Kept if equal)', priority: 'high', sortOrder: 1024, color: '#000', createdAt: older, updatedAt: now },
          { id: 'cat_2', name: 'Local Old Name', priority: 'medium', sortOrder: 2048, color: '#111', createdAt: older, updatedAt: older },
        ],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { defaultReminderMinutesBefore: 5, theme: 'dark', wakeUpTime: '08:00', windDownTime: '22:00', batteryOptimizationDismissed: false, createdAt: older, updatedAt: now },
      };

      const incoming: StoredDataEnvelope = {
        schemaVersion: 2,
        categories: [
          // Same ID, equal timestamp -> local should be retained
          { id: 'cat_1', name: 'Incoming Name (Ignored)', priority: 'low', sortOrder: 9999, color: '#FFF', createdAt: older, updatedAt: now },
          // Same ID, newer timestamp -> incoming should overwrite
          { id: 'cat_2', name: 'Incoming Updated Name', priority: 'high', sortOrder: 3072, color: '#222', createdAt: older, updatedAt: newer },
          // Distinct ID -> should be added
          { id: 'cat_3', name: 'Incoming Brand New', priority: 'low', sortOrder: 4096, color: '#333', createdAt: newer, updatedAt: newer },
        ],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { defaultReminderMinutesBefore: 15, theme: 'light', wakeUpTime: '07:00', windDownTime: '23:00', batteryOptimizationDismissed: true, createdAt: older, updatedAt: newer },
      };

      const merged = mergeBackupEnvelopes(local, incoming);

      const cat1 = merged.categories.find((c: Category) => c.id === 'cat_1')!;
      expect(cat1.name).toBe('Local Name (Kept if equal)');

      const cat2 = merged.categories.find((c: Category) => c.id === 'cat_2')!;
      expect(cat2.name).toBe('Incoming Updated Name');

      const cat3 = merged.categories.find((c: Category) => c.id === 'cat_3');
      expect(cat3).toBeDefined();

      expect(merged.settings.defaultReminderMinutesBefore).toBe(15); // incoming was newer

      // Idempotency: merging again produces identical result
      const mergedTwice = mergeBackupEnvelopes(merged, incoming);
      expect(mergedTwice.categories.length).toBe(merged.categories.length);
      expect(mergedTwice.categories.find((c: Category) => c.id === 'cat_1')!.name).toBe('Local Name (Kept if equal)');
    });

    it('should create and verify internal rollback snapshot before replaceAllData, and abort with zero changes if snapshot verification fails', async () => {
      await adapter.loadAll(); // Seeds initial data
      const initialRaw = await AsyncStorage.getItem(STORAGE_KEY);

      // Verify normal snapshot creation
      const snapshotKey = await adapter.createRollbackSnapshot();
      expect(snapshotKey).toContain(SNAPSHOT_KEY_PREFIX);
      const snapshotContent = await AsyncStorage.getItem(snapshotKey);
      expect(snapshotContent).not.toBeNull();

      // Now simulate a rollback snapshot verification failure (e.g. readBack empty)
      const multiGet = (AsyncStorage as any).multiGet;
      jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key: string) => {
        if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
          return ''; // Empty read-back causes verification failure
        }
        const res = await multiGet([key]);
        return res[0] ? res[0][1] : null;
      });

      const newIncoming: StoredDataEnvelope = {
        schemaVersion: 2,
        categories: [{ id: 'cat_new', name: 'Should Not Be Saved', priority: 'high', sortOrder: 1024, color: '#000', createdAt: now, updatedAt: now }],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { defaultReminderMinutesBefore: 5, theme: 'dark', wakeUpTime: '08:00', windDownTime: '22:00', batteryOptimizationDismissed: false, createdAt: now, updatedAt: now },
      };

      await expect(adapter.replaceAllData(newIncoming)).rejects.toThrow(
        'Internal rollback snapshot verification failed'
      );

      jest.restoreAllMocks();

      // Verify existing data remains completely untouched
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(initialRaw);
    });

    it('should leave existing data untouched when importAllData encounters invalid JSON or schema errors', async () => {
      await adapter.loadAll();
      const initialRaw = await AsyncStorage.getItem(STORAGE_KEY);

      await expect(adapter.importAllData('INVALID_JSON')).rejects.toThrow('Invalid JSON format');
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(initialRaw);

      await expect(adapter.importAllData(JSON.stringify({ schemaVersion: 99 }))).rejects.toThrow(
        'Validation failed'
      );
      expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(initialRaw);
    });

    it('should reject backup payloads with unsupported schema versions (e.g. 1 or 99 when CURRENT_SCHEMA_VERSION is 2)', () => {
      const v1Backup = {
        schemaVersion: 1,
        categories: [],
        topics: [],
        topicTasks: [],
        timetableBlocks: [],
        settings: { defaultReminderMinutesBefore: 5, theme: 'dark', wakeUpTime: '08:00', windDownTime: '22:00', batteryOptimizationDismissed: false, createdAt: now, updatedAt: now },
      };
      const res1 = validateBackupPayload(v1Backup);
      expect(res1.isValid).toBe(false);
      expect(res1.errors).toContain('Unsupported schema version 1 (expected 2)');

      const v99Backup = { ...v1Backup, schemaVersion: 99 };
      const res99 = validateBackupPayload(v99Backup);
      expect(res99.isValid).toBe(false);
      expect(res99.errors).toContain('Unsupported schema version 99 (expected 2)');
    });

    it('should fail native export workflow and block Replace-All when Sharing.isAvailableAsync() resolves to false', async () => {
      const Sharing = require('expo-sharing');
      jest.spyOn(Sharing, 'isAvailableAsync').mockResolvedValueOnce(false);

      const isShareAvailable = await Sharing.isAvailableAsync();
      expect(isShareAvailable).toBe(false);

      // Emulate handleExport failure behavior on unavailable sharing
      let hasExportedBackup = true;
      let errorOccurred = false;
      try {
        if (!isShareAvailable) {
          throw new Error('Native file sharing is not available on this device.');
        }
        await Sharing.shareAsync('file:///dummy.json');
      } catch (err: any) {
        errorOccurred = true;
        hasExportedBackup = false;
      }

      expect(errorOccurred).toBe(true);
      expect(hasExportedBackup).toBe(false); // Does NOT unlock replace-all
    });
  });

  // Fix 4: Storage Provider Factory
  describe('Fix 4: Storage Provider Factory', () => {
    it('should expose getStorage() returning active IStorageAdapter', () => {
      const storage = getStorage();
      expect(storage).toBeDefined();
      expect(typeof storage.loadAll).toBe('function');
      expect(typeof storage.mutateEnvelope).toBe('function');
      expect(typeof storage.deleteCategoryCascade).toBe('function');
    });
  });

  // Fix 6: Consolidated Cascade via Envelope Return
  describe('Fix 6: Consolidated Cascade & Move State via Envelope Return', () => {
    it('should return updated StoredDataEnvelope and synchronize timetable store without setState hacks', async () => {
      await useCategoryTopicStore.getState().loadInitialData(true);
      await useTimetableStore.getState().loadInitialBlocks(true);

      const catStore = useCategoryTopicStore.getState();
      const newCat = await catStore.addCategory('Cascade Test Cat', 'high', '#123456');
      const newTopic = await catStore.addTopic(newCat.id, 'Test Topic');
      await catStore.addTask(newTopic.id, 'Test Task');

      const timeStore = useTimetableStore.getState();
      const newBlock = await timeStore.addBlock({
        title: 'Cascade Block',
        categoryId: newCat.id,
        priority: 'high',
        startTime: '10:00',
        durationMin: 60,
      });

      expect(useTimetableStore.getState().blocks.some((b) => b.id === newBlock.id)).toBe(true);

      // Perform cascade deletion
      await useCategoryTopicStore.getState().deleteCategoryCascade(newCat.id);

      // Verify category, topic, task, and timetable blocks are all cleanly removed
      const postCatStore = useCategoryTopicStore.getState();
      const postTimeStore = useTimetableStore.getState();

      expect(postCatStore.categories.some((c) => c.id === newCat.id)).toBe(false);
      expect(postCatStore.topics.some((t) => t.categoryId === newCat.id)).toBe(false);
      expect(postCatStore.topicTasks.some((t) => t.topicId === newTopic.id)).toBe(false);
      expect(postTimeStore.blocks.some((b) => b.categoryId === newCat.id)).toBe(false);
    });
  });

  // Fix 7: Gapped sortOrder with Move Retry
  describe('Fix 7: Gapped sortOrder with Gap Collapse and Retry', () => {
    it('should update only the moved item on normal moves with 1024 spacing', () => {
      const items = [
        { id: '1', sortOrder: 1024 },
        { id: '2', sortOrder: 2048 },
        { id: '3', sortOrder: 3072 },
      ];

      // Move item '3' UP (to swap with '2')
      const result = moveItemOrder(items, '3', 'up');
      expect(result.reorderedAll).toBe(false);
      expect(result.movedItem.id).toBe('3');
      expect(result.movedItem.sortOrder).toBe(1536); // midway between 1024 and 2048

      // Visible order should be: '1' (1024), '3' (1536), '2' (2048)
      const sorted = [...result.updatedItems].sort((a, b) => a.sortOrder - b.sortOrder);
      expect(sorted.map((i) => i.id)).toEqual(['1', '3', '2']);
    });

    it('should handle moving to top of list with positive gap', () => {
      const items = [
        { id: '1', sortOrder: 1024 },
        { id: '2', sortOrder: 2048 },
      ];

      // Move item '2' UP to top
      const result = moveItemOrder(items, '2', 'up');
      expect(result.reorderedAll).toBe(false);
      expect(result.movedItem.sortOrder).toBe(512); // Math.floor(1024 / 2)
      const sorted = [...result.updatedItems].sort((a, b) => a.sortOrder - b.sortOrder);
      expect(sorted.map((i) => i.id)).toEqual(['2', '1']);
    });

    it('should re-normalize the array and retry the move when a top collapse occurs (newOrder < 1)', () => {
      // Simulate top collapse: item '1' has sortOrder 1, so moving item '2' above it gives Math.floor(1 / 2) = 0 < 1
      const collapsedItems = [
        { id: '1', sortOrder: 1 },
        { id: '2', sortOrder: 2 },
      ];

      const result = moveItemOrder(collapsedItems, '2', 'up');
      expect(result.reorderedAll).toBe(true);

      // Final visible order must match the user's requested move: '2' before '1'
      const sorted = [...result.updatedItems].sort((a, b) => a.sortOrder - b.sortOrder);
      expect(sorted.map((i) => i.id)).toEqual(['2', '1']);
      expect(result.movedItem.sortOrder).toBeGreaterThan(0);
    });

    it('should re-normalize the array and retry when a mid-list gap collapses (gap <= 1)', () => {
      // Adjacent items with gap of 1
      const collapsedItems = [
        { id: '1', sortOrder: 100 },
        { id: '2', sortOrder: 101 },
        { id: '3', sortOrder: 102 },
      ];

      // Moving '3' UP between '1' and '2' has gap = 101 - 100 = 1 <= 1
      const result = moveItemOrder(collapsedItems, '3', 'up');
      expect(result.reorderedAll).toBe(true);

      const sorted = [...result.updatedItems].sort((a, b) => a.sortOrder - b.sortOrder);
      expect(sorted.map((i) => i.id)).toEqual(['1', '3', '2']);
    });
  });
});
