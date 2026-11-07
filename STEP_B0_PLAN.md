# Step B0 Implementation Plan: Milestone A Hardening

**Branch:** `feat/topics-tasks-timetable`  
**Status:** Proposed — Awaiting Architecture & Specification Approval (Claude & ChatGPT)  
**Date:** 2026-11-07  

---

## Overview

Step B0 hardens the Milestone A interactive core before transitioning to Milestone B (Firebase & EAS Native builds). It resolves seven reliability, concurrency, and validation gaps identified during technical review, without adding out-of-scope features or starting Milestone B.

---

## 1. Proposed Package Dependencies (Approval Required)

To support real-device file writing, sharing, and document picking on Android and web:

| Package | Recommended Version | Purpose |
|---|---|---|
| `expo-file-system` | `~19.0.x` (SDK 58 compatible) | Writes backup JSON string to Android cache/document filesystem |
| `expo-sharing` | `~14.0.x` (SDK 58 compatible) | Opens native Android share sheet / "Save to files" |
| `expo-document-picker` | `~14.0.x` (SDK 58 compatible) | Opens native file picker to select `.json` backup file for import |

*Note: These packages will NOT be installed until explicit user/reviewer approval is granted via `npx expo install`.*

---

## 2. Seven Hardening Fixes

### Fix 1: AsyncStorageAdapter Corruption Recovery, Write-Lock & In-Place Migrations
- **Target Files:**
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `src/types/storage.ts`
  - `app/(tabs)/index.tsx` (Global error barrier)
- **Implementation Approach:**
  - **Truly Absent Key:** Only seed default data (`DEFAULT_CATEGORIES`, `DEFAULT_TOPICS`) when `AsyncStorage.getItem(STORAGE_KEY)` returns strictly `null`.
  - **Corrupted JSON or Unsupported Schema Version:**
    1. Do NOT reset or overwrite with defaults.
    2. Immediately copy the raw payload to `@time_mgmt_app_data_recovery_<ISO_TIMESTAMP>`.
    3. Set internal lock: `this.isLocked = true` with details `{ recoveryKey, reason }`.
    4. **Write-Lock Mechanism:** All `mutateEnvelope()` operations check `if (this.isLocked) throw new StorageLockedError(...)`, rejecting any write until resolved.
    5. **UI Recovery Dialog:** Displays two options:
       - *Export Corrupted Raw Data:* Allows user to download or copy the raw string to recover data manually.
       - *Reset Database:* Explicit user confirmation required to clear the lock and re-initialize.
  - **Versioned Migration:** Introduce `migrateEnvelope(rawParsed: any): StoredDataEnvelope` with sequential schema updaters (e.g. `v1 -> v2`) rather than falling back to defaults.
- **Tests Required:**
  - Malformed JSON string copied to recovery key, locks writes, surfaces error.
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
    1. Write file to `${FileSystem.cacheDirectory}time_management_backup_${date}.json`.
    2. **Verification Pipeline:**
       - Call `FileSystem.getInfoAsync(fileUri)`: verify `exists === true` and `size > 0`.
       - Read file back and execute `JSON.parse` to guarantee syntactical validity.
    3. If verified, trigger `Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save Backup' })`.
    4. Only show success message *"Backup exported and verified"* after the verification pipeline succeeds.
    5. If any step fails, catch and display a clear error alert.
- **Tests Required:**
  - Mocked filesystem test verifying write, size assertion, JSON re-parse verification, and error alert on write failure.

---

### Fix 3: Full Schema Validation, Pre-Backup & Typed Import UI
- **Target Files:**
  - `src/utils/backupValidator.ts` (New module)
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `app/(tabs)/settings.tsx`
- **Implementation Approach:**
  - **Deep Schema Validation:**
    - Validates envelope structure and types (`schemaVersion`, `categories`, `topics`, `topicTasks`, `timetableBlocks`, `settings`).
    - Validates date formats (`AppTimestamp` objects with `{ seconds, nanoseconds }`, ISO strings).
    - Checks for duplicate IDs within each array.
    - **Referential Integrity:** Rejects payload if any topic references a missing `categoryId`, any task references a missing `topicId`, or any timetable block references a missing `categoryId`.
  - **Import Preview Modal:**
    - Shows record counts before applying: Categories (N), Topics (N), Topic Tasks (N), Timetable Blocks (N).
    - User selects **Merge** or **Replace All**.
  - **Merge Behavior:**
    - *ID Collisions:* Compare `updatedAt`. If incoming is newer, update; otherwise keep local. If user chooses non-destructive import, generate a new ID (`generateId()`) and remap all child references.
    - *Relationship Validation:* Orphaned records without parent categories are rejected from merge.
  - **Replace-All Behavior:**
    - **Mandatory Pre-Backup:** Automatically exports current state to `@time_mgmt_pre_replace_backup_<timestamp>` and verifies it exists and parses.
    - **Abort Policy:** If pre-backup creation or verification fails, **the import immediately aborts**. No wipe occurs. User receives an error alert.
    - **Typed Confirmation:** User must type `REPLACE` to confirm deletion of local data.
- **Tests Required:**
  - Missing arrays / wrong types -> rejected.
  - Duplicate IDs -> rejected / remapped.
  - Orphan references -> rejected.
  - Pre-backup abort: simulated pre-backup failure aborts Replace-All with 0 changes to database.

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
  - Stores and screens import `getStorage()` rather than the concrete `AsyncStorageAdapter`.
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

### Fix 7: Gapped `sortOrder` (Multiples of 1024) with Re-normalization
- **Target Files:**
  - `src/utils/sortOrder.ts` (New module)
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `src/stores/categoryTopicStore.ts`
- **Implementation Approach:**
  - **Spacing:** Items are initialized or renumbered in multiples of 1024: `1024, 2048, 3072, 4096...`
  - **Single-Item Write on Move:**
    - Moving between item A and item B: `newSortOrder = Math.floor((sortOrderA + sortOrderB) / 2)`.
    - Moving to top: `newSortOrder = sortOrderFirst > 1024 ? sortOrderFirst - 1024 : Math.floor(sortOrderFirst / 2)`.
    - Moving to bottom: `newSortOrder = sortOrderLast + 1024`.
    - Only the moved item's `sortOrder` is updated and saved.
  - **Handling Gap Collapse:** When `sortOrderB - sortOrderA <= 1`, no integer gap remains. The algorithm triggers an automatic **re-normalization pass** on that specific array: sorts by `(sortOrder, id)`, re-spaces cleanly to `(index + 1) * 1024`, and writes the array in one pass.
  - **Deterministic Tie-Break:**
    ```typescript
    (a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id.localeCompare(b.id))
    ```
  - **Migration:** Existing stored data with sequential numbers (`1, 2, 3...`) are migrated to multiples of 1024 on first load.
- **Tests Required:**
  - Single-item write on move between items.
  - Gap collapse detection and automatic re-normalization pass.
  - Deterministic tie-break sorting with `id.localeCompare`.
  - Migration of sequential 1-based sort orders.

---

## 3. Reviewer Verification Checklist (For ChatGPT & Claude)

- [ ] Does the write-lock policy on corrupted data completely eliminate silent data overwrites?
- [ ] Are the proposed package versions (`expo-file-system`, `expo-sharing`, `expo-document-picker`) compatible with Expo SDK 58?
- [ ] Does the Replace-All abort policy on pre-backup failure sufficiently protect user data?
- [ ] Is the gapped sortOrder algorithm with automatic collapse re-normalization optimal for local & future Firestore synchronization?
