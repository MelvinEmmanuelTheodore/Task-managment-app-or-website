# Review Queue & Technical Inquiry Log

This document tracks technical proposals, architectural reviews, open questions, and feedback from **ChatGPT** (Architect, Technical Reviewer & Approval Authority), **User** (Final Decision-Maker & Manual Tester), and **Antigravity** (Implementation Lead & Sole Developer).

---

## Active Review Items

| ID | Item Description | Raised By | Status | Details & Proposed Solution |
|---|---|---|---|---|
| **REV-005** | Exact Alarm Verification (`delivery: 'alarmClock'`) on physical device | ChatGPT & User | **Pending Step 3.5 Test** | Requires physical device testing on Android 13/14+ to verify wake behavior. Fallback: Notifee if `expo-notifications` fails. |
| **REV-006** | Phase 5 Serverless Cost & Backend Architecture | ChatGPT & User | **Open (Deferred to Phase 5)** | Retained as UNDECIDED. We will evaluate free-tier alternatives before considering paid Cloud Functions. Keys must never appear in frontend code. |
| **REV-017** | Step B0 Hardening Specification & Architecture Plan | ChatGPT & Antigravity | **Open for Review (ChatGPT & User)** | Detailed 7-point hardening plan documented in `STEP_B0_PLAN.md` and Decision 016 (write-lock on corruption, verified export/import, pre-backup abort, gapped sortOrder, getStorage factory). |
| **REV-015** | Milestone A Entity Separation & Local Storage Architecture | User / Antigravity | **Resolved in Milestone A** | Implemented 4 entities (`Category`, `Topic`, `TopicTask`, `TimetableBlock`), transactional `AsyncStorageAdapter`, cascade delete/move safeguards, and pure serialisable `AppTimestamp`. |
| **REV-016** | ChatGPT Milestone A Audit Gaps (Editing, Theme, Serialisation, Concurrency, Deletion, Validation) | ChatGPT | **Resolved** | Implemented category/topic/task full editing and reordering, theme storage persistence, pure `AppTimestamp` (`{ seconds, nanoseconds }`), transactional multi-record operations in `mutateEnvelope`, dual-option category deletion dialog, exact calendar date validator with leap-year handling, and 20 passing unit tests. |

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
| **REV-011** | Backup Safety on Import | Claude / GPT | Configured JSON import ("Replace All") with mandatory verified pre-backup before wiping. |
| **REV-012** | Secret & Credential Filtering | ChatGPT / Claude | Hardened `.gitignore` to cover `.env*` (except `.env.example`), `.firebase/`, logs, keystores, and service accounts. |
| **REV-013** | Timestamp Type Compatibility across SDKs | ChatGPT / Claude | Created domain `AppTimestamp` interface, decoupling shared models from concrete SDK timestamp classes. |
| **REV-014** | Private Repository Visibility Correction | ChatGPT / Claude | Corrected `AI_WORKFLOW.md` to accurately state that the GitHub repository is Private. |
