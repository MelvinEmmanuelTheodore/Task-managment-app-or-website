# Review Queue & Technical Inquiry Log

This document tracks technical proposals, architectural reviews, open questions, and feedback from **ChatGPT** (Architect, Technical Reviewer & Approval Authority), **User** (Final Decision-Maker & Manual Tester), and **Antigravity** (Implementation Lead & Sole Developer).

---

## Active Review Items & Preserved Stage Blockers

| ID | Item Description | Raised By | Status | Details & Proposed Solution |
|---|---|---|---|---|
| **REV-005** | Exact Alarm Verification (`delivery: 'alarmClock'`) on physical device | ChatGPT & User | **Pending Step 3.5 Test** | Requires physical device testing on Android 13/14+ to verify wake behavior. Fallback: Notifee if `expo-notifications` fails. |
| **REV-006** | Phase 5 Serverless Cost & Backend Architecture | ChatGPT & User | **Open (Deferred to Phase 5)** | Retained as UNDECIDED. We will evaluate free-tier alternatives before considering paid Cloud Functions. Keys must never appear in frontend code. |
| **REV-017** | Step B0 Hardening Specification & Architecture Plan | ChatGPT & Antigravity | **Implemented on `feat/topics-tasks-timetable`** | Implemented 7-point hardening: corruption write-lock, raw payload in-memory retention & recovery retry, schemaVersion: 2 with sequential migration, Replace-All external backup export enforcement, verified export with modern File API/expo-sharing, settings import with expo-document-picker, schema validation, deterministic merge (seconds + nanoseconds), rollback snapshot verification, getStorage factory, redundant settings.categories removal, cascade envelope return, and gapped sortOrder (1024). 50 automated unit tests pass; physical Android device testing pending. |
| **REV-018** | Step B0 migrateVersion() Post-Migration Validation & Future Schema Handling | ChatGPT & User | **DEFERRED / KNOWN ISSUE** | The remaining validation gap in `migrateVersion()` edge cases is recorded as a known issue and deferred while proceeding with Milestone B. Step B0 is not marked as fully approved and remains unmerged on `feat/topics-tasks-timetable`. |
| **REV-019** | Firestore History Validation & Append-Only Enforcement | ChatGPT | **Step B2 Blocker** | Must be implemented and validated via Firebase Emulator security rules tests in Step B2. Rules must enforce that existing `actualHistory` entries are strictly preserved (immutable and order-preserving) and that newly appended items conform to `ActualHistoryEntry` schema. |
| **REV-020** | Real Calendar-Date Validation in Security Rules | ChatGPT | **Step B2 Blocker** | Must be addressed in Step B2 rules specification. Strict regex (`^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`) validates calendar formatting; evaluate constraints for month-end day bounds (e.g. Feb 30/31) within Firestore rules limitations or domain pre-write validators. |
| **REV-021** | Replace-All Rollback Safety & Incomplete Session Recovery | ChatGPT | **Step B5 Blocker** | Must be implemented in Step B5. Replace-All cloud cleanup must use auditable soft-delete tombstones tagged with `replaceSessionId`. An interrupted session must be automatically rolled back on next app launch, restoring the verified pre-replacement snapshot. |
| **REV-022** | Dependency & Platform Configuration for Android Development Build | ChatGPT | **PARTIALLY VERIFIED — Android native build pending** | Exact packages installed and verified under TypeScript, Expo config parsing (`expo config --type public`), and web bundling (`expo export --platform web`). Full native Android compilation (Gradle build, TurboModules codegen) will be verified upon executing the EAS/local development build. |
| **REV-023** | Google Sign-In 17.0.0 Legacy Android SDK & Credential Manager Consideration | ChatGPT | **Step B3 Blocker / Consideration** | Review `@react-native-google-signin/google-signin@17.0.0` native Android dependencies and Google's deprecation of legacy GoogleSignInClient in favor of Credential Manager on modern Android (API 34+). Verify required Play Services auth configurations and native scopes before implementing `auth.native.ts` in Step B3. |

---

## Resolved Review Items

| ID | Item Description | Raised By | Resolution |
|---|---|---|---|
| **REV-001** | Dual-SDK Strategy Evaluation (`@react-native-firebase` vs `firebase/firestore`) | Antigravity / GPT | Adopted platform-specific file abstraction (`.native.ts` / `.web.ts`). Firestore persistence backed by native SQLite on Android, IndexedDB on Web. |
| **REV-002** | Alarm Delivery Mode & Android 14+ Permissions | Claude / GPT | Using `delivery: 'alarmClock'` with graceful fallback to `bestEffort`. Permissions checked via `getExactAlarmPermissionsAsync()`. Foreground resync checks for revoked permissions on every app open. |
| **REV-003** | Stale Notification Handling when Android App is Closed | Claude / User | Unified 7-day rolling schedule + foreground self-healing resync + daily repeating safety-net alarms for wake/sleep. |
| **REV-004** | Initial Git & Toolchain Bootstrap on Windows Host | Antigravity | **Resolved:** Git v2.56.0 and Node.js v26.13.0 installed. Repository initialized and tracking remote `main`. |
| **REV-007** | Deterministic Task Generation IDs & Idempotency | Claude / GPT | Adopted `${templateId}_${date}_${blockId}` with create-if-not-exists transactions. Existing tasks are never overwritten. |
| **REV-008** | Server-Side Security Rule Validation | ChatGPT | Added comprehensive Firestore Security Rules checking key whitelist (`hasOnly`), types, ownership, duration limits, valid transitions, and write-once actual times protection. |
| **REV-009** | Web IndexedDB Multi-Tab Caching | ChatGPT | Configured `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` with public workstation privacy warnings. |
| **REV-010** | Reopen Action for Mistakenly Completed Tasks | Claude | Added deliberate reopen action that moves existing run into `actualHistory` and resets `actualStart`/`actualEnd` to null for fresh timing. |
| **REV-011** | Backup Safety on Import | ChatGPT / User | Adopted mandatory external backup export with required user acknowledgement, plus separate verified internal rollback snapshot before Replace-All. |
| **REV-012** | Secret & Credential Filtering | ChatGPT / Claude | Hardened `.gitignore` to cover `.env*` (except `.env.example`), `.firebase/`, logs, keystores, and service accounts. |
| **REV-013** | Timestamp Type Compatibility across SDKs | ChatGPT / Claude | Created domain `AppTimestamp` interface, decoupling shared models from concrete SDK timestamp classes. |
| **REV-014** | Private Repository Visibility Correction | ChatGPT / Claude | Corrected `AI_WORKFLOW.md` to accurately state that the GitHub repository is Private. |
| **REV-015** | Milestone A Entity Separation & Local Storage Architecture | User / Antigravity | Implemented 4 entities (`Category`, `Topic`, `TopicTask`, `TimetableBlock`), transactional `AsyncStorageAdapter`, cascade delete/move safeguards, and pure serialisable `AppTimestamp`. |
| **REV-016** | ChatGPT Milestone A Audit Gaps (Editing, Theme, Serialisation, Concurrency, Deletion, Validation) | ChatGPT | Implemented category/topic/task full editing and reordering, theme storage persistence, pure `AppTimestamp` (`{ seconds, nanoseconds }`), transactional multi-record operations in `mutateEnvelope`, dual-option category deletion dialog, exact calendar date validator with leap-year handling, and 20 passing unit tests. |
