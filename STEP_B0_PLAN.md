# Step B0 Implementation Plan: Milestone A Hardening (Revised)

**Branch:** `feat/topics-tasks-timetable`  
**Status:** Proposed — Awaiting Approval (User, Claude & ChatGPT)  
**Date:** 2026-11-07  

---

## Overview

Step B0 hardens the Milestone A interactive core before transitioning to Milestone B (Firebase & EAS Native builds). It resolves seven reliability, concurrency, and validation gaps identified during technical review, without adding out-of-scope features or starting Milestone B.

---

## 1. Expo Package Dependencies (SDK 58 Compatibility & API Standard)

The project uses Expo SDK 58 (`expo: ~58.0.23`, `react: 19.3.0`, `react-native: 0.88.1`). The exact SDK 58 package versions required are:

| Package | SDK 58 Version | Purpose |
|---|---|---|
| `expo-file-system` | `~58.0.11` | Writes backup JSON string to Android cache/document filesystem |
| `expo-sharing` | `~58.0.22` | Opens native Android share sheet / "Save to files" |
| `expo-document-picker` | `~58.0.4` | Opens native file picker to select `.json` backup file for import |

### API Standard: Modern File/Paths API
To avoid fragile legacy mixing, all filesystem operations in Step B0 will strictly use the **modern Expo File/Paths API**:
- Import: `import { File, Paths } from 'expo-file-system';`
- File instantiation: `const backupFile = new File(Paths.cache, `time_management_backup_${dateStr}.json`);`
- Write: `await backupFile.write(jsonString);`
- Verify: `if (!backupFile.exists || backupFile.size === 0) throw new Error(...);`
- Read: `const text = await backupFile.text();`
- Legacy APIs (`FileSystem.writeAsStringAsync`, `FileSystem.cacheDirectory` string paths) will **not** be mixed into this implementation.

*Note: These packages will NOT be installed until explicit user approval is granted.*

---

## 2. Seven Hardening Fixes

### Fix 1: AsyncStorageAdapter: Corruption Recovery, Write-Lock & In-Place Migrations
- **Target Files:**
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `src/types/storage.ts`
  - `app/(tabs)/index.tsx` (Global error barrier)
- **Implementation Approach:**
  - **Truly Absent Key:** Only seed default data (`DEFAULT_CATEGORIES`, `DEFAULT_TOPICS`) when `AsyncStorage.getItem(STORAGE_KEY)` returns strictly `null`.
  - **Corrupted JSON or Unsupported Schema Version:**
    1. Do NOT reset or overwrite with defaults.
    2. Attempt to save the raw corrupted string to recovery key `@time_mgmt_app_data_recovery_<ISO_TIMESTAMP>`.
    3. **Recovery-Copy Failure Safety:** If writing the recovery copy fails (e.g. storage error or quota issue):
       - **Never initialize defaults.**
       - Keep the original string intact under the primary storage key.
       - Retain the raw payload in memory.
       - Keep all writes locked (`this.isLocked = true`).
       - Provide UI options to copy the in-memory payload to the clipboard or retry recovery.
    4. **Write-Lock Mechanism:** All `mutateEnvelope()` operations check `if (this.isLocked) throw new StorageLockedError(...)`, rejecting any write until resolved.
    5. **UI Recovery Dialog:** Displays two options:
       - *Export/Copy Raw Corrupted Data:* Allows user to rescue raw data manually.
       - *Reset Database:* Explicit user action required to clear the lock and re-initialize.
  - **Versioned Migration:** Introduce `migrateEnvelope(rawParsed: any): StoredDataEnvelope` with sequential schema updaters (e.g. `v1 -> v2`) rather than falling back to defaults.
- **Tests Required:**
  - Malformed JSON string copied to recovery key, locks writes, surfaces error.
  - **Recovery-copy write failure:** verifies original value preserved under primary key, writes remain locked, and defaults are NEVER initialized.
  - Unknown future `schemaVersion` (e.g. 99) locks writes and preserves raw payload.
  - Missing storage key seeds initial defaults cleanly.
  - Sequential schema migration upgrades payload without resetting.

---

### Fix 2: Verified File Export & Native Sharing
- **Target Files:**
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `app/(tabs)/settings.tsx`
- **Implementation Approach:**
  - **Web:** Preserves standard verified Blob download (`a.download`).
  - **Android Native:**
    1. Instantiate file using modern API: `const file = new File(Paths.cache, filename)`.
    2. Write: `await file.write(jsonString)`.
    3. **Verification Pipeline:**
       - Assert `file.exists === true` and `file.size > 0`.
       - Read content back via `await file.text()` and run `JSON.parse` to verify syntactical validity.
    4. If verified, trigger `Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Backup' })`.
    5. Only show success message *"Backup exported and verified"* after the verification pipeline succeeds.
    6. If any step fails, catch and display a clear error alert: *"Backup export failed"*.
- **Tests Required:**
  - Mocked filesystem test verifying write, size assertion, JSON re-parse verification, and error alert on write failure.

---

### Fix 3: Full Schema Validation, Internal Rollback Snapshot & Typed Import UI
- **Target Files:**
  - `src/utils/backupValidator.ts` (New module)
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `app/(tabs)/settings.tsx`
- **Implementation Approach:**
  - **Deep Schema Validation (`validateBackupPayload`):**
    - Validates envelope structure and types (`schemaVersion`, `categories`, `topics`, `topicTasks`, `timetableBlocks`, `settings`).
    - Validates date formats (`AppTimestamp` objects with `{ seconds, nanoseconds }`, ISO strings).
    - Checks for duplicate IDs within each array.
    - **Referential Integrity:** Rejects payload if any topic references a missing `categoryId`, any task references a missing `topicId`, or any timetable block references a missing `categoryId`.
  - **Import Preview Modal:**
    - Shows record counts before applying: Categories (N), Topics (N), Topic Tasks (N), Timetable Blocks (N).
    - User selects **Merge** or **Replace All**.
  - **Merge Collision Policy:**
    - **Case A: Same Logical Record (Same ID & Matching Signature):**
      - If incoming item shares an ID and represents the same entity (e.g. category with matching name/domain):
      - Compare `updatedAt.seconds`. If `incoming.updatedAt.seconds > local.updatedAt.seconds`, update the record; otherwise, retain local record.
    - **Case B: Accidental ID Collision (Same ID, Distinct Entity):**
      - If incoming item shares an ID with a local item but represents a different entity:
      - Generate a fresh ID (`generateId()`) for the incoming entity.
      - Record the mapping `oldId -> newId` in a remapping dictionary.
    - **Topological Child Reference Remapping:**
      Process entities in strict dependency order:
      1. *Categories:* re-key collisions -> update category dictionary.
      2. *Topics:* re-key collisions -> update `topic.categoryId = idMap[topic.categoryId] || topic.categoryId`.
      3. *TopicTasks:* re-key collisions -> update `task.topicId = idMap[task.topicId] || task.topicId`.
      4. *TimetableBlocks:* re-key collisions -> update `block.categoryId = idMap[block.categoryId] || block.categoryId`.
    - **No Silent Overwrites:** Different records never overwrite each other; logical duplicates are merged strictly by `updatedAt`.
  - **Replace-All Behavior:**
    - **Internal Rollback Snapshot:** Before wiping, the adapter serializes the current state to `@time_mgmt_internal_rollback_snapshot_<timestamp>`. This is an internal rollback fail-safe, distinguished from external downloadable JSON backups.
    - **Verification & Abort Policy:** Verify the internal rollback snapshot exists, is non-empty, and parses. If verification fails, **the import immediately aborts with zero changes to existing data**.
    - **Typed Confirmation:** User must type `REPLACE` to confirm deletion of local data.
- **Tests Required:**
  - Malformed backups rejected (missing arrays, invalid timestamps, duplicate IDs, orphaned foreign keys).
  - Merge ID collisions: verifies same logical record resolved by `updatedAt`, distinct colliding record re-keyed, and child references remapped correctly.
  - Replace-All internal rollback snapshot creation and verification.
  - Failed internal rollback snapshot aborts Replace-All with zero modifications to existing data.

---

### Fix 4: Storage Provider Factory (`getStorage()`)
- **Target Files:**
  - `src/services/storage/index.ts` (New file)
  - `src/stores/categoryTopicStore.ts`
  - `src/stores/timetableStore.ts`
  - `src/stores/themeStore.ts`
  - `app/(tabs)/settings.tsx`
- **Implementation Approach:**
  - Export `getStorage(): IStorageAdapter` returning the active singleton.
  - Stores and screens import `getStorage()` rather than referencing `AsyncStorageAdapter` directly.
  - Prepares the app for mock testing and Milestone B dual-SDK integration with zero behavior change.
- **Tests Required:**
  - Verify `getStorage()` returns an instance implementing `IStorageAdapter`.

---

### Fix 5: Remove Redundant `UserSettings.categories` & Deep-Copy Defaults
- **Target Files:**
  - `src/types/settings.ts`
  - `src/constants/defaultData.ts`
  - `src/services/storage/AsyncStorageAdapter.ts`
- **Implementation Approach:**
  - Remove `categories: string[]` from `UserSettings` interface.
  - In `AsyncStorageAdapter` migration: ignore/drop legacy `settings.categories` if present in stored data.
  - In `getInitialData()`: Deep-copy default constants (`JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))`) to ensure runtime mutations never alter module-level constants.
- **Tests Required:**
  - Loading stored payload with legacy `settings.categories` drops the field cleanly.
  - Mutating store categories leaves `DEFAULT_CATEGORIES` untouched.

---

### Fix 6: Consolidate Cascade & Move-Category Logic in Adapter
- **Target Files:**
  - `src/services/storage/IStorageAdapter.ts`
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `src/stores/categoryTopicStore.ts`
- **Implementation Approach:**
  - All cascading logic (updating topics, topic tasks, timetable blocks on category delete or move) lives strictly inside `AsyncStorageAdapter` within the sequential `mutateEnvelope` transaction.
  - Store actions (`deleteCategoryCascade`, `moveCategoryContentsAndDelete`) delegate directly to the adapter and synchronize in-memory state.
  - Removes duplicate filtering routines between store and storage.
- **Tests Required:**
  - Cascade delete and move-contents integration tests verifying all 4 entity collections remain consistent.

---

### Fix 7: Gapped `sortOrder` (Multiples of 1024) with Collapse Re-normalization & Move Retry
- **Target Files:**
  - `src/utils/sortOrder.ts` (New module)
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `src/stores/categoryTopicStore.ts`
- **Implementation Approach:**
  - **Spacing:** Items are initialized or renumbered in multiples of 1024: `1024, 2048, 3072, 4096...`
  - **Single-Item Write on Normal Move:**
    - Moving between item A and item B: `newSortOrder = Math.floor((sortOrderA + sortOrderB) / 2)`.
    - Moving to top: if `sortOrderFirst > 1`, `newSortOrder = Math.floor(sortOrderFirst / 2)`.
    - Moving to bottom: `newSortOrder = sortOrderLast + 1024`.
    - Only the moved item's `sortOrder` is updated and saved.
  - **Handling Gap Collapse & Re-normalization with Move Retry:**
    - When `sortOrderB - sortOrderA <= 1`, or when moving to top and `sortOrderFirst <= 1`, no positive integer gap remains.
    - **Step 1:** The algorithm executes an in-memory re-normalization pass on the array: sorts all items by `(sortOrder, id)` and re-spaces them to clean multiples of 1024 (`(index + 1) * 1024`).
    - **Step 2:** The algorithm retries the requested move using the freshly re-spaced array, calculating the exact target `sortOrder` for the moved item.
    - **Step 3:** The entire array is persisted with the item in its exact intended visible position.
    - This guarantees the visible list order always strictly matches the user's requested move.
  - **Deterministic Tie-Break:**
    ```typescript
    (a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id.localeCompare(b.id))
    ```
  - **Migration:** Existing stored data with sequential numbers (`1, 2, 3...`) are migrated to multiples of 1024 on first load.
- **Tests Required:**
  - Single-item write on move between items.
  - **Gap collapse with move retry:** verifies re-normalization occurs and moved item lands in the exact requested visible slot.
  - **Top-of-list collapse:** verifies move to top succeeds even when `sortOrderFirst <= 1`.
  - Deterministic tie-break sorting with `id.localeCompare`.
  - Migration of sequential 1-based sort orders.

---

## 3. Reviewer Verification Checklist (For ChatGPT & Claude)

- [ ] Does the modern `File`/`Paths` API specification prevent legacy mixing?
- [ ] Is the merge collision distinction (same entity `updatedAt` vs distinct entity re-keying + child remapping) clear and safe?
- [ ] Does the re-normalize and retry strategy for gap collapse guarantee the requested visible order?
- [ ] Is the internal rollback snapshot terminology and abort policy distinct from external backups?
- [ ] Does the recovery-copy failure policy guarantee zero silent resets?
