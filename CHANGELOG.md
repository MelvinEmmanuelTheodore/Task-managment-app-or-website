# Changelog

All notable changes, architectural decisions, and milestones for this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Multi-AI Documentation Suite:** Created `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `REVIEW_QUEUE.md`, and `AI_WORKFLOW.md`.
- **Git Security:** Added `.env.example` template and hardened `.gitignore` for `.env*`, `.firebase/`, logs, keystores, signing keys, service accounts, and Firebase config files.
- **Decoupled Timestamp Model:** Defined agnostic `AppTimestamp` domain interface, eliminating direct SDK coupling to `firebase/firestore` Timestamp class and ensuring compile compatibility with `@react-native-firebase/firestore`.
- **Execution Run History (`actualHistory`):** Added `ActualTimeEntry[]` schema on `Task` to preserve audit records when tasks are reopened.
- **Deterministic Stable Block IDs:** Updated task generation to use `${sourceTemplateId}_${date}_${blockId}` with create-if-not-exists transactions.
- **Mandatory Pre-Backup on Import:** Implemented verified safety export before executing "Replace All" JSON imports.
- **Enhanced Security Rules:** Added whitelist validation (`keys().hasOnly()`), status state machine checks, write-once actual times enforcement, and structural schemas for routine templates and settings.

### Changed
- **Repository Visibility:** Updated `AI_WORKFLOW.md` to accurately reflect that the GitHub repository is Private.
- **Alarm Permission Revocation:** Updated foreground resync to detect revoked `SCHEDULE_EXACT_ALARM` permissions and re-register exact alarms upon app launch.
- **Phase 5 Decision 013:** Removed client-side BYOK option; strictly enforced that API keys will never appear in frontend code.
- **Alarm Claims Softened:** Marked `delivery: 'alarmClock'` as UNVERIFIED on target physical hardware pending Step 3.5 physical testing, with Notifee designated as fallback.
- **Decision Statuses:** Maintained all entries in `DECISIONS.md` as "Proposed — Awaiting User Approval".
