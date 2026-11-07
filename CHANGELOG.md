# Changelog

All notable changes, architectural decisions, and milestones for this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Step B0 Hardening Architecture Specification & Two-AI Governance Updates (`feat/topics-tasks-timetable`):**
  - Updated `AI_WORKFLOW.md` to formalize the two-AI governance model (ChatGPT as Architect/Reviewer, Antigravity as Sole Developer/Git Operator, User as Decision-Maker & Manual Tester).
  - Revised `STEP_B0_PLAN.md` and `DECISIONS.md` (Decision 016):
    - Strict adherence to Expo SDK 58 compatible versions (`expo-file-system: ~58.0.11`, `expo-sharing: ~58.0.22`, `expo-document-picker: ~58.0.4`) and modern `File`/`Paths` API without legacy mixing.
    - Deterministic Import Merge policy (same ID = same record, newer `updatedAt` wins, equal `updatedAt` retains local, idempotent, rejects duplicate internal IDs and broken foreign keys).
    - Replace-All dual safety backups: user-facing downloadable external backup prompt + separate verified internal rollback snapshot with abort on failure, plus typed `REPLACE` confirmation.
    - Pre-migration raw v1 state preservation before migrating to v2; aborts if preservation fails; blocks migrations while storage is locked.
    - Storage factory `getStorage(): IStorageAdapter` for dependency decoupling.
    - Cascade/move state synchronization via envelope return from storage adapter, avoiding cross-store `setState` hacks.
    - Accurate export messaging: *"Backup file ready: choose where to save it."*
    - Gapped `sortOrder` (multiples of 1024) with automatic re-normalization and retry on gap collapse.

### Added
- **Milestone A — Interactive Core Audit Fixes (`feat/topics-tasks-timetable`):**
  - **Category & Topic Full Editing & Reordering:** Added modal editing for category renaming, priority changing, and color selection; topic editing for renaming and priority changes; added Up/Down ordering controls for both categories and topics (`moveCategoryOrder`, `moveTopicOrder`) with persistent sort order.
  - **Category Deletion & Content Migration Dialog:** Enhanced deletion dialog with accurate real-time dependency counts (topics, topic tasks, timetable blocks). Implemented two clear paths: cascade deletion of all dependencies or moving all contents to another chosen category, with immediate updates to persistent storage and both in-memory Zustand stores (`categoryTopicStore` and `timetableStore`).
  - **Theme Persistence:** Connected `themeStore.ts` to `IStorageAdapter.getSettings()` and `saveSettings()`. Added `initTheme()` on app startup in `app/_layout.tsx` so dark/light/system preference survives app restarts.
  - **Pure Serialisable AppTimestamp:** Decoupled `AppTimestamp` from object methods (`toDate()`, `toMillis()`, `toISOString()`), retaining only `{ seconds, nanoseconds }` to guarantee complete JSON serialisation fidelity. Added standalone utility functions in `src/utils/dateHelpers.ts`.
  - **Transactional Storage Concurrency & Multi-Record Atomic Operations:** Encapsulated all multi-record operations (`reorderCategories`, `reorderTopics`, `deleteCategoryCascade`, `moveCategoryContentsAndDelete`) directly inside the transactional `mutateEnvelope` queue in `AsyncStorageAdapter`, completely eliminating race conditions and accidental overwrites during concurrent updates.
  - **Topic Task Full Editing:** Added full editing modal in `app/topic/[id].tsx` supporting title, priority, due date, and notes, with inline creation support and `onEdit` hook on all `TaskItem` components.
  - **Exact Calendar Date Validation & Timetable Protection:** Enforced actual calendar-date validation in `src/utils/timetableValidators.ts` using `Date.UTC` round-trip comparison, correctly rejecting impossible dates like `2026-02-29`, `2026-02-31`, `2026-04-31` while validating true leap-year dates (`2024-02-29`, `2028-02-29`). Enforced `HH:mm` 24-hour time format and duration limits (5-480 minutes).
  - **Comprehensive Test Suite:** Added `src/__tests__/milestoneA.test.ts` (12 new tests, 20 total passing across 3 suites) verifying timestamp round-trip, storage concurrency under concurrent multi-record load, theme persistence across reloads, category/topic editing and reordering, cascade deletion and content moving, task editing, and exact calendar date and timetable validation.

- **Milestone A — Interactive Core Initial Scaffolding (`feat/topics-tasks-timetable`):**
  - **Category & Topic Manager:** Fully interactive manager screen (`app/(tabs)/categories.tsx`) supporting category addition, color customization, priority selection (`high`|`medium`|`low`), sort ordering, topic creation, active/deactivate toggle, and safe cascade deletion with dependency inspection dialogs.
  - **Topic Tasks View:** Dedicated topic screen (`app/topic/[id].tsx`) with task creation, due dates, priority labels, completion checkboxes, pending/completed lists, and dynamic topic progress percentage.
  - **Dashboard Integration:** Active topics grouped by category, sorted by category priority (`high` -> `medium` -> `low`) and category `sortOrder`, displaying real-time topic completion progress bars.
  - **Interactive Timetable:** Replaced static preview with full timetable management (`app/(tabs)/tasks.tsx`), supporting block creation, category assignment, fixed commitment flags, deletion, and shift confirmation dialogs (Decision 007).
  - **Data Layer & Persistence:** Implemented `IStorageAdapter` and `AsyncStorageAdapter` featuring a serialized Promise write queue and versioned data envelope (`schemaVersion: 1`). Persists theme settings and database state across restarts.
  - **JSON Export:** Added JSON backup export in Settings (`app/(tabs)/settings.tsx`).
  - **Testing Infrastructure:** Installed Jest and `jest-expo`, configured `jest.setup.js` with AsyncStorage mocks, added npm scripts (`typecheck`, `test`), and wrote 8 unit tests covering storage CRUD, category rules, cascade deletions, and progress calculation.

### Changed
- Replaced temporary 9 categories with user's 6 official categories and default topics in `src/constants/defaultData.ts`.
- Removed "Fixed" as a category and retained it strictly as the `isFixed: boolean` flag on timetable blocks.
- Postponed Firebase setup (Step 3) and real-device alarm verification (Step 3.5) to Milestone B.
