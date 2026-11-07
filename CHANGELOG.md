# Changelog

All notable changes, architectural decisions, and milestones for this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Milestone A — Interactive Core Audit Fixes (`feat/topics-tasks-timetable`):**
  - **Category & Topic Full Editing & Reordering:** Added modal editing for category renaming, priority changing, and color selection; topic editing for renaming and priority changes; added Up/Down ordering controls for both categories and topics (`moveCategoryOrder`, `moveTopicOrder`) with persistent sort order.
  - **Category Deletion & Content Migration Dialog:** Enhanced deletion dialog with accurate real-time dependency counts (topics, topic tasks, timetable blocks). Implemented two clear paths: cascade deletion of all dependencies or moving all contents to another chosen category, with immediate updates to persistent storage and both in-memory Zustand stores (`categoryTopicStore` and `timetableStore`).
  - **Theme Persistence:** Connected `themeStore.ts` to `IStorageAdapter.getSettings()` and `saveSettings()`. Added `initTheme()` on app startup in `app/_layout.tsx` so dark/light/system preference survives app restarts.
  - **Pure Serialisable AppTimestamp:** Decoupled `AppTimestamp` from object methods (`toDate()`, `toMillis()`, `toISOString()`), retaining only `{ seconds, nanoseconds }` to guarantee complete JSON serialisation fidelity. Added standalone utility functions in `src/utils/dateHelpers.ts`.
  - **Transactional Storage Concurrency:** Replaced isolated writes in `AsyncStorageAdapter` with a transactional `mutateEnvelope` queuing the entire read-modify-write operation sequentially, eliminating lost updates during rapid concurrent operations.
  - **Topic Task Full Editing:** Added full editing modal in `app/topic/[id].tsx` supporting title, priority, due date, and notes, with inline creation support and `onEdit` hook on all `TaskItem` components.
  - **Timetable Input Validation & Protection:** Added validators in `src/utils/timetableValidators.ts` enforcing `HH:mm` 24-hour time format (`00:00`-`23:59`), duration limits (5-480 minutes), and date formatting. Added block date editing with explicit schedule shift confirmation dialogs and fixed commitment protection.
  - **Comprehensive Test Suite:** Added `src/__tests__/milestoneA.test.ts` (11 new tests, 19 total passing across 3 suites) verifying timestamp round-trip, storage concurrency under load, theme persistence across reloads, category/topic editing and reordering, cascade deletion and content moving, task editing, and timetable validation.

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
