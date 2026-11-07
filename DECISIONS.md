# Design Decisions Log

This document records architectural choices, evaluation of alternatives, and implementation decisions.

---

## Decision 001 — Tech Stack
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

| Choice | Selected | Alternatives Considered | Reason |
|---|---|---|---|
| Framework | Expo (React Native) + TypeScript | Flutter, React Native CLI | Single codebase for Android + Web; fast iteration, built-in tooling. |
| Routing | Expo Router (file-based) | React Navigation manual config | Simpler structure, built-in deep linking, clean web URL routing. |
| State | Zustand | Redux Toolkit, Context API | Minimal boilerplate, hook-based, excellent TypeScript performance. |
| Database | Firebase Firestore | Supabase, Local SQLite only | Built-in real-time sync across mobile & web; generous free tier. |
| Auth | Firebase Auth (Google Sign-In) | Email/Password, Supabase Auth | Fast single-tap authentication; direct link to Firestore security rules. |
| Notifications | expo-notifications (local) | Push via FCM, Notifee | Works offline, requires no server backend in Phase 1. |
| Web Hosting | Firebase Hosting | Vercel, Netlify | Native integration with existing Firebase project and CLI. |

---

## Decision 002 — Development Build vs Expo Go
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Use Expo Go for initial Step 1 & Step 2 UI scaffolding, then transition to an **EAS Development Build** at Step 3 (Firebase & Notifications).

**Accurate Technical Distinctions:**
- **What Expo Go Can Do:** Basic local notifications (`scheduleNotificationAsync`), UI layouts, simple Zustand state, and standard web/mock workflows.
- **Why Development Build is Required:**
  1. Google Sign-In via native OAuth (`@react-native-google-signin/google-signin`).
  2. Native Firestore disk persistence (`@react-native-firebase/firestore`).
  3. Custom Android notification channels with sound/vibration overrides.
  4. Notification action buttons ("Start now", "Done").
  5. Exact alarm scheduling (`SCHEDULE_EXACT_ALARM`) and boot receivers.

---

## Decision 003 — Dual Firebase SDK Strategy & Decoupled Domain Types
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Use `@react-native-firebase/firestore` (native Android SDK) on Android and `firebase/firestore` (JS modular SDK) on web, united under a shared service interface (`firestore.ts`) and a decoupled, serialisable `AppTimestamp` domain type.

---

## Decision 004 — Notification Sync & Rolling Window
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Align both **task generation** and **notification scheduling** to a unified **7-day rolling window**.

---

## Decision 005 — Android Alarm Delivery Mode
**Date:** 2026-11-07  
**Status:** UNVERIFIED on target physical hardware (Confirmation in Step 3.5)  

**Decision:** Utilize `delivery: 'alarmClock'` on Android `IMPORTANCE_HIGH` channels for time-critical alarms.

---

## Decision 006 — Routine Generation: Deterministic IDs & Create-If-Not-Exists
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Routine templates generate independent task instances for a 7-day rolling window using deterministic IDs:
`${sourceTemplateId}_${date}_${blockId}` (using a stable string `blockId` rather than index).

---

## Decision 007 — No Automatic Schedule Changes & Reopening Tasks
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** The system will never silently alter or delete tasks without user confirmation.
- On reopen, the previous execution record (`actualStart`, `actualEnd`, `reopenedAt`) is archived into an `actualHistory` array.
- Current `actualStart` and `actualEnd` reset to null for fresh timing.

---

## Decision 008 — Timestamp Storage (UTC) and Display (IST)
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** All timestamps stored in UTC. Displayed and queried in IST (`Asia/Kolkata`, UTC+5:30).

---

## Decision 009 — Write-Once Actual Execution Times & Execution History
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** `actualStart` and `actualEnd` are immutable once set during an active session. They cannot be overwritten during planned schedule edits.

---

## Decision 010 — Dual-Layer Task Validation
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Validate task properties both on the client before write and on the server via Firestore Security Rules.

---

## Decision 011 — Backup & Recovery Protocol with Verified Pre-Backup
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Settings screen provides manual JSON Export and Import with mandatory pre-backup verification.

---

## Decision 012 — Physical Device Alarm Test Suite (Step 3.5)
**Date:** 2026-11-07  
**Status:** Approved by user (2026-11-07)  

**Decision:** Step 3.5 requires passing a structured physical-device alarm checklist before building remaining Phase 1 features.

---

## Decision 013 — Costs & Phase 5 Architecture Route
**Date:** 2026-11-07  
**Status:** UNDECIDED for Phase 5  

**Decision:** Phases 1–4 run strictly on the Firebase Spark (Free) plan and Expo EAS Free Tier. Phase 5 architecture remains UNDECIDED.

---

## Decision 014 — Milestone A: Domain Entity Separation & Naming
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Split application models into 4 distinct domain entities:
1. `Category`: High-level domains with `priority` ('high'|'medium'|'low'), `sortOrder` (number), and color.
2. `Topic`: Projects/workstreams grouped by category via `categoryId`. Has `priority`, `sortOrder`, and `isActive` toggle.
3. `TopicTask`: Normalized to-do items referencing `topicId`. Does not store categoryId directly (derived through Topic).
4. `TimetableBlock`: A documented, forward-compatible subset of the approved `Task` schema representing scheduled time slots. Retains nullable placeholders for deferred fields (`status`, `actualStart`, `actualEnd`, `actualHistory`) ensuring seamless migration in Step 3/4 and Step 10.

---

## Decision 015 — Local Storage Adapter & Serialized Write Queue
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Implement `AsyncStorageAdapter` implementing `IStorageAdapter` with a serialized Promise queue:
- Wraps all AsyncStorage writes in an internal queue (`writeQueue = writeQueue.then(op)`), preventing race conditions and file clobbering from rapid UI state updates.
- Stores all entities within a versioned envelope (originally `schemaVersion: 1`; updated to `schemaVersion: 2` in Step B0).
- Persists theme preferences and settings across app restarts via `getSettings()` / `saveSettings()`.
- Swapping to a cloud adapter in Step 3/4 requires zero changes to UI components or Zustand stores.

---

## Decision 016 — Step B0: Milestone A Hardening & Resilience Specifications
**Date:** 2026-11-07  
**Status:** In Progress — Implemented, Verification & Review Pending (Automated tests pass; Physical device verification pending)  

**Decision:** Prior to starting Milestone B (Firebase), execute Step B0 hardening on `feat/topics-tasks-timetable`:
1. **SDK 58 Package Alignment & Modern File/Paths API:** Use Expo SDK 58 compatible versions (`expo-file-system: ~58.0.13`, `expo-sharing: ~58.0.22`, `expo-document-picker: ~58.0.4`). Strictly use the modern `File`/`Paths` API (`new File(Paths.cache, ...)`) across all native filesystem workflows; avoid mixing with legacy `FileSystem.writeAsStringAsync`.
2. **Corruption Protection & Recovery-Copy Failure Safety:** On JSON parse error, invalid envelope structure (including `null`, primitives, or missing schemaVersion), or unsupported future schema version, preserve raw data at `@time_mgmt_app_data_recovery_<timestamp>` and lock writes. If writing the recovery copy fails, keep the original string intact under primary key, retain raw payload in memory, keep writes locked, and return an empty locked envelope (never default data). Provide UI actions in Settings to view/copy the raw payload and retry saving the recovery copy.
3. **Verified File Export & Accurate Messaging:** Verify written file existence, non-zero size, and parseability on Android before showing success and triggering `expo-sharing`. Show message *"Backup file ready: choose where to save it."*
4. **Validated Import Workflow, Deterministic Merge & Dual Replace-All Backups:**
   - **Document Picker Workflow:** Select file via `expo-document-picker` (`application/json`), read text via modern File API, perform deep schema validation (`validateBackupPayload`), and show preview modal. Cancellation or read/validation failure leaves existing data completely untouched.
   - **Deterministic Merge Policy:** Same ID represents the same logical record. Compare `updatedAt` across both `seconds` and `nanoseconds`; newer incoming record wins. Equal timestamps retain local data. Do not automatically remap IDs. Repeated imports are idempotent.
   - **Replace-All Dual Backups:** Mandatory external backup export operation required before enabling the acknowledgement checkbox (cannot proceed merely by checking the box without completing the export); separate internal rollback snapshot (`@time_mgmt_internal_rollback_snapshot_<timestamp>`) created and verified in AsyncStorage (aborting immediately with zero changes if snapshot creation or verification fails); requires typed `REPLACE` confirmation.
5. **Adopted Schema v2 & Pre-Write Validated Migration:** Adopted `schemaVersion: 2` as the active envelope format. Implemented sequential version migration (`v1 -> v2`) with rigorous pre- and post-validation: validates incoming v1 envelope structure and core collections before attempting migration, safely catches transformer exceptions, validates the resulting v2 envelope before writing to primary storage, and preserves the raw v1 payload at `@time_mgmt_pre_migration_v1_<timestamp>`. If validation, preservation, or migration steps fail, primary storage remains completely untouched, storage is locked, and the raw payload is preserved in recovery storage. Rejects genuinely unsupported future versions (e.g. `schemaVersion: 3` or `99`).
6. **Storage Provider Factory:** Decouple stores via `getStorage(): IStorageAdapter` in `src/services/storage/index.ts`.
7. **Clean Domain Model & Unified Cascade State:** Drop redundant `UserSettings.categories`, deep-copy initial defaults. Adapter cascade/move methods return updated `StoredDataEnvelope`; stores update state directly from returned envelope (no cross-store `setState` hacks).
8. **Gapped sortOrder with Move Retry:** Items spaced by multiples of 1024, writing only the moved item on normal moves. When a gap collapses (or at top when `sortOrder <= 1`), re-normalize the array first, retry the requested move, and save the array with the moved item in its exact intended visible position. Deterministic tie-break via `(sortOrder, id.localeCompare)`.
