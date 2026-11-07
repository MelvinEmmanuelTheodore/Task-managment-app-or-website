# Changelog

All notable changes, architectural decisions, and milestones for this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Step 1 Scaffolding Complete:**
  - Initialized Expo SDK 58 + React Native 0.88 + TypeScript project with Expo Router v58.
  - Installed cross-platform dependencies: `react-native-safe-area-context`, `react-native-screens`, `react-native-web`, `react-dom`, `@expo/metro-runtime`, and `zustand`.
  - Configured file-based navigation layout with tabbed routes: Dashboard (`/`), Timetable (`/tasks`), and Settings (`/settings`).
  - Added modular types (`Task`, `RoutineTemplate`, `UserSettings`, `AppTimestamp`), constants (categories, colors, default routine blocks), and date/IST formatting helpers.
  - Verified static web export (`expo export --platform web`) and strict TypeScript compilation (`tsc --noEmit`).
- **Multi-AI Documentation Suite:** Created `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `REVIEW_QUEUE.md`, and `AI_WORKFLOW.md`.
- **Git Security:** Added `.env.example` template and hardened `.gitignore` for `.env*`, `.firebase/`, logs, keystores, signing keys, service accounts, and Firebase config files.
- **Decoupled Timestamp Model:** Defined agnostic, serialisable `AppTimestamp` domain interface, eliminating direct SDK coupling to `firebase/firestore` Timestamp class and ensuring compile compatibility with `@react-native-firebase/firestore`.
- **Execution Run History (`actualHistory`):** Added `ActualTimeEntry[]` schema on `Task` to preserve audit records when tasks are reopened.
- **Deterministic Stable Block IDs:** Updated task generation to use `${sourceTemplateId}_${date}_${blockId}` with create-if-not-exists transactions.
- **Mandatory Pre-Backup on Import:** Implemented verified safety export before executing "Replace All" JSON imports.
- **Enhanced Security Rules:** Added whitelist validation (`keys().hasOnly()`), status state machine checks, write-once actual times enforcement, and structural schemas for routine templates and settings.

### Changed
- **Architecture & Decisions Approval:** User confirmed approval of Phase 1 specifications and Decisions 001–004 and 006–012 on 2026-11-07. Decision 005 remains UNVERIFIED on target physical hardware pending Step 3.5 testing. Decision 013 Phase 5 architecture remains UNDECIDED.
- **Online-Only Routine Generation:** Documented that routine transactions run only when online, skip silently when offline, and never block the UI.
- **Removed completedAt:** Replaced `completedAt` in reopen history with `actualEnd`.
- **Best-Effort Notification Clarity:** Accurately detailed `bestEffort` notification delivery via Android inexact alarms with 5–15 min OS batching.
- **Repository Visibility:** Updated `AI_WORKFLOW.md` to accurately reflect that the GitHub repository is Private.
