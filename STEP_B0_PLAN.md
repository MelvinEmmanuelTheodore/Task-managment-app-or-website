# Step B0 Implementation Plan: Milestone A Hardening (Final Specification)

**Branch:** `feat/topics-tasks-timetable`  
**Status:** Proposed — Awaiting User Approval  
**Architect & Technical Reviewer:** ChatGPT  
**Developer & Operator:** Antigravity  
**Final Decision-Maker:** User  
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

### Fix 1: AsyncStorageAdapter: Corruption Recovery, Write-Lock & Versioned Migrations
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
  - **Versioned Migration Safety:**
    - Introduce `migrateEnvelope(rawParsed: any): StoredDataEnvelope` with sequential schema updaters (e.g. `v1 -> v2`).
    - **Pre-Migration Safety Preservation:** Before migrating from v1 to v2, preserve the original raw v1 payload in `@time_mgmt_pre_migration_v1_<timestamp>`.
    - **Never migrate locked or corrupted data.**
    - If pre-migration preservation fails, abort migration immediately and retain the original data untouched.
- **Tests Required:**
  - Malformed JSON string copied to recovery key, locks writes, surfaces error.
  - **Recovery-copy write failure:** verifies original value preserved under primary key, writes remain locked, and defaults are NEVER initialized.
  - Unknown future `schemaVersion` (e.g. 99) locks writes and preserves raw payload.
  - Missing storage key seeds initial defaults cleanly.
  - Pre-migration preservation: verifies v1 payload is preserved before v2 migration; failed preservation aborts migration.

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
    5. **Accurate Export Status Message:** After creation and verification, display:
       > **"Backup file ready: choose where to save it."**
       *(Do not imply that the user has saved the file merely because the native share sheet opened).*
    6. If any step fails, catch and display a clear error alert: *"Backup export failed"*.
- **Tests Required:**
  - Mocked filesystem test verifying write, size assertion, JSON re-parse verification, and error alert on write failure.

---

### Fix 3: Settings Import UI, Full Schema Validation, Deterministic Merge & Dual Replace-All Backups
- **Target Files:**
  - `src/utils/backupValidator.ts` (New module)
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `app/(tabs)/settings.tsx`
- **Implementation Approach:**
  - **File Selection & Reading Workflow (`expo-document-picker`):**
    1. User taps "Import Backup" in Settings.
    2. Open system file picker via `DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true })`.
    3. **Cancellation Handling:** If user cancels the file picker (`result.canceled === true`), exit immediately with zero modifications and no error alerts (clean exit).
    4. **Reading File Contents:** Read the selected file contents using the modern File API (`new File(result.assets[0].uri).text()`).
    5. **Deep Schema Validation:** Parse JSON and validate completely with `validateBackupPayload(parsed)`:
       - Validates envelope structure and types (`schemaVersion`, `categories`, `topics`, `topicTasks`, `timetableBlocks`, `settings`).
       - Validates date formats (`AppTimestamp` objects with `{ seconds, nanoseconds }`, ISO strings).
       - Checks for duplicate IDs within each array.
       - **Referential Integrity:** Rejects payload if any topic references a missing `categoryId`, any task references a missing `topicId`, or any timetable block references a missing `categoryId`.
    6. **Validation Failure Safety:** If JSON parsing, file read, or schema validation fails, display a clear modal/banner listing the specific validation errors. **Leave existing data completely untouched.**
    7. **Import Preview Modal:** If validation succeeds, display the preview modal showing record counts before applying: Categories (N), Topics (N), Topic Tasks (N), Timetable Blocks (N).
       - User selects **Merge** or **Replace All**.
  - **Deterministic Import Merge Policy:**
    - **Same ID = Same Logical Record:**
      - If an incoming entity shares an ID with an existing local entity, it represents the same logical record.
      - **Precise Timestamp Comparison:** Compare both `AppTimestamp.seconds` and `AppTimestamp.nanoseconds`:
        - Incoming wins if `incoming.updatedAt.seconds > local.updatedAt.seconds`, or if `incoming.updatedAt.seconds === local.updatedAt.seconds && incoming.updatedAt.nanoseconds > local.updatedAt.nanoseconds`.
        - Otherwise (incoming is older or timestamps are equal), retain the existing local record.
      - **Equal Timestamps:** When `seconds` and `nanoseconds` are both identical, retain the existing local record.
    - **No Automatic ID Remapping:** Do not remap IDs during Merge. Same IDs are merged deterministically; distinct IDs are added.
    - **Idempotency:** Importing the same backup repeatedly is completely idempotent and will never create duplicates or ghost records.
    - **Conflicting Records & Validation:** Duplicate IDs within the imported file itself or invalid parent-child relationships cause the entire import to be rejected with a descriptive error list.
  - **Replace-All Behavior & Dual Safety Backups:**
    1. **Required External Backup Step:** External backup is a mandatory prerequisite before Replace-all. The app triggers export/sharing of a full JSON backup file.
    2. **Explicit User Acknowledgement:** Require explicit user confirmation via an acknowledgement checkbox:
       > *"I have exported and saved a backup file to a safe external location."*
       *(Note: The app does not claim or attempt to verify that the user completed an external file save in the OS file picker or sharing sheet; it requires explicit user acknowledgement).*
    3. **Separate Internal Rollback Snapshot:** In addition to the required external backup step, the storage adapter serializes current state to `@time_mgmt_internal_rollback_snapshot_<timestamp>`.
    4. **Verification & Abort Policy:** Verify the internal snapshot exists, is non-empty, and parses. If snapshot creation or verification fails, **the Replace-All immediately aborts with zero changes to existing data**.
    5. **Typed Confirmation:** User must acknowledge the external backup save and type `REPLACE` in a text prompt to confirm destruction of current data.
- **Tests Required:**
  - File picker cancellation or read/validation failure leaves existing data untouched.
  - Malformed backups rejected (missing arrays, invalid timestamps, internal duplicate IDs, orphaned foreign keys).
  - Merge policy: newer `updatedAt` wins comparing both `seconds` and `nanoseconds`; equal timestamps keep local; repeating merge is idempotent.
  - Replace-All external backup required acknowledgement + verified internal rollback snapshot.
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

### Fix 6: Consolidated Cascade & Move State via Envelope Return
- **Target Files:**
  - `src/services/storage/IStorageAdapter.ts`
  - `src/services/storage/AsyncStorageAdapter.ts`
  - `src/stores/categoryTopicStore.ts`
  - `src/stores/timetableStore.ts`
- **Implementation Approach:**
  - Adapter methods `deleteCategoryCascade(categoryId)` and `moveCategoryContentsAndDelete(fromCatId, toCatId)` return the **updated `StoredDataEnvelope`**.
  - Stores update their in-memory state directly from the returned envelope:
    ```typescript
    const updatedEnvelope = await getStorage().deleteCategoryCascade(categoryId);
    set({
      categories: updatedEnvelope.categories,
      topics: updatedEnvelope.topics,
      topicTasks: updatedEnvelope.topicTasks,
    });
    useTimetableStore.getState().setBlocksFromEnvelope(updatedEnvelope.timetableBlocks);
    ```
  - **No cross-store `setState` hacks:** Timetable store exposes an explicit action `setBlocksFromEnvelope(blocks: TimetableBlock[])` to receive synchronized state cleanly.
- **Tests Required:**
  - Cascade delete and move-contents integration tests verifying all 4 entity collections update consistently from the returned envelope.

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

## 3. Reviewer Verification Checklist (For ChatGPT & User)

- [ ] Does the modern `File`/`Paths` API specification prevent legacy mixing?
- [ ] Is the merge collision policy (same ID = same record, newer `updatedAt` wins, equal `updatedAt` keeps local, idempotent) deterministic and safe?
- [ ] Are dual backups for Replace-All (user-facing external export + verified internal rollback snapshot) clearly separated?
- [ ] Does the pre-migration preservation policy guarantee zero risk when upgrading from v1 to v2?
- [ ] Does the envelope-return pattern eliminate cross-store `setState` hacks?
- [ ] Does the re-normalize and retry strategy for gap collapse guarantee the requested visible order?
