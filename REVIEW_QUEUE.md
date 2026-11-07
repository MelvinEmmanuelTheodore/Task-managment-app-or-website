# Review Queue & Technical Inquiry Log

This document tracks technical proposals, architectural reviews, open questions, and feedback from **Claude** (Planning & Specifications), **ChatGPT** (Independent Reviewer & Verifier), and **Antigravity** (Implementation Lead).

---

## Active Review Items

| ID | Item Description | Raised By | Status | Details & Proposed Solution |
|---|---|---|---|---|
| **REV-005** | Exact Alarm Verification (`delivery: 'alarmClock'`) on physical device | Claude & ChatGPT | **Pending Step 3.5 Test** | Requires physical device testing on Android 13/14+ to verify wake behavior. Fallback: Notifee if `expo-notifications` fails. |
| **REV-006** | Phase 5 Serverless Cost & Backend Architecture | Claude | **Open (Deferred to Phase 5)** | Retained as UNDECIDED. We will evaluate free-tier alternatives before considering paid Cloud Functions. |

---

## Resolved Review Items

| ID | Item Description | Raised By | Resolution |
|---|---|---|---|
| **REV-001** | Dual-SDK Strategy Evaluation (`@react-native-firebase` vs `firebase/firestore`) | Antigravity / GPT | Adopted platform-specific file abstraction (`.native.ts` / `.web.ts`). Firestore persistence backed by native SQLite on Android, IndexedDB on Web. |
| **REV-002** | Alarm Delivery Mode & Android 14+ Permissions | Claude / GPT | Using `delivery: 'alarmClock'` with graceful fallback to `bestEffort`. Permissions checked via `getExactAlarmPermissionsAsync()`. |
| **REV-003** | Stale Notification Handling when Android App is Closed | Claude / User | Unified 7-day rolling schedule + foreground self-healing resync + daily repeating safety-net alarms for wake/sleep. |
| **REV-004** | Initial Git & Toolchain Bootstrap on Windows Host | Antigravity | **Resolved:** Git v2.56.0 and Node.js v26.13.0 installed. Repository initialized and tracking remote `main`. |
| **REV-007** | Deterministic Task Generation IDs | Claude | Adopted `${templateId}_${date}_${blockIndex}` format to eliminate duplicate creation across multi-device sync. |
| **REV-008** | Server-Side Security Rule Validation | ChatGPT | Added comprehensive Firestore Security Rules checking types, ownership, duration limits, and valid time ranges. |
| **REV-009** | Web IndexedDB Multi-Tab Caching | ChatGPT | Configured `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` with public workstation privacy warnings. |
| **REV-010** | Reopen Action for Mistakenly Completed Tasks | Claude | Added deliberate reopen action that preserves `actualStart` and `actualEnd` timestamps. |
| **REV-011** | Backup Safety on Import | Claude | Configured JSON import ("Replace All") to trigger an automatic in-memory download of the existing state first. |
| **REV-012** | Secret & Credential Filtering | ChatGPT / Claude | Hardened `.gitignore` and provided clean `.env.example`. |
