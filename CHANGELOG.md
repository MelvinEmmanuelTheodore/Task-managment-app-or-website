# Changelog

All notable changes, architectural decisions, and milestones for this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Multi-AI Documentation Suite:** Created `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `REVIEW_QUEUE.md`, and `AI_WORKFLOW.md`.
- **Git Security:** Added `.env.example` template and hardened `.gitignore` for keystores, signing keys, service accounts, and Firebase config files.
- **Complete Schemas:** Added complete TypeScript schemas for `Task`, `RoutineTemplate`, `RoutineBlock`, and `UserSettings` to `ARCHITECTURE.md`.
- **Deterministic Routine IDs:** Implemented `${sourceTemplateId}_${date}_${blockIndex}` ID format to prevent duplicate routine task generation across multiple devices.
- **Task Reopen Feature:** Documented a deliberate reopen action for tasks marked completed by mistake, preserving actual start and end timestamps.
- **Safety Auto-Backup on Import:** Configured JSON "Replace All" import to trigger an automatic in-memory safety download of existing data before proceeding.
- **Safety Net Alarms:** Configured daily repeating alarms for Wake-up (08:00 IST) and Wind-down (22:45 IST) independent of rolling generation.
- **Physical Device Test Suite:** Defined 6-scenario alarm testing matrix for Step 3.5 (foreground, closed, locked/Doze, reboot, battery saver, DND).

### Changed
- **Unified Rolling Window:** Expanded both task generation and local notification scheduling to a synchronized 7-day rolling window.
- **Web Offline Persistence:** Explicitly documented `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` backed by browser IndexedDB with multi-tab sync and workstation privacy considerations.
- **Security Rules:** Strengthened Firestore Security Rules with server-side validation for types, field length (title 1-200), durations (5-480 min), ownership, and `plannedEnd > plannedStart`.
- **Decision Statuses:** Updated all entries in `DECISIONS.md` to "Proposed — Awaiting User Approval".
- **Decision 002 Refinement:** Clarified precise capabilities of Expo Go vs EAS Development Builds.
- **Decision 005 Refinement:** Marked `delivery: 'alarmClock'` as UNVERIFIED on target physical hardware pending Step 3.5 verification, with Notifee designated as fallback.
- **Decision 013 (Costs):** Documented Firebase Spark / EAS limits and explicitly designated Phase 5 architecture as UNDECIDED.
- **Documentation Links:** Replaced local Windows `file:///` URLs with clean relative Markdown links in `AI_WORKFLOW.md`.
- **Review Queue:** Resolved bootstrap item REV-004 and added tracking for alarm verification (REV-005) and Phase 5 routing (REV-006).
