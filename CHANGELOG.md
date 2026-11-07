# Changelog

All notable changes, architectural decisions, and milestones for this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Milestone A — Interactive Core Completed (`feat/topics-tasks-timetable`):**
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
