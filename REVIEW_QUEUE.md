# Review Queue & Technical Inquiry Log

This document tracks technical proposals, architectural reviews, open questions, and disagreements between **Claude** (Planning & Specifications), **ChatGPT** (Independent Reviewer & Verifier), and **Antigravity** (Implementation Lead).

---

## Active Review Items

| ID | Item Description | Raised By | Status | Reviewer Notes | Resolution / Decision |
|---|---|---|---|---|---|
| **REV-001** | Dual-SDK Strategy Evaluation (`@react-native-firebase` vs `firebase/firestore` on Android) | Antigravity | **Approved** | Firebase JS SDK lacks durable storage on RN (in-memory only). Native SDK backed by SQLite is required for app-kill durability. | Adopted platform-specific file abstraction (`.native.ts` / `.web.ts`). Recorded in `DECISIONS.md` (Decision 003). |
| **REV-002** | Alarm Delivery Mode (`delivery: 'alarmClock'` vs `bestEffort`) on Android 14+ | Antigravity | **Approved** | `SCHEDULE_EXACT_ALARM` is denied by default on Android 14+ fresh installs. Graceful fallback to `bestEffort` required if permission denied. | Added runtime permission checks and settings redirect banner. Recorded in `DECISIONS.md` (Decision 005). |
| **REV-003** | Notification Stale State Handling when Android app is terminated | User / Antigravity | **Approved** | Firestore listeners cannot run in background when app is killed. | 7-day rolling schedule window + foreground self-healing resync + web warning banner for <2h tasks. Recorded in `DECISIONS.md` (Decision 004). |
| **REV-004** | Initial Git & Toolchain Bootstrap on Windows Host | Antigravity | **Pending User Setup** | Host machine requires Git CLI and Node.js LTS installations before local repository initialization and Expo scaffolding can begin. | Awaiting user confirmation of Git and Node installation. |

---

## Closed / Resolved Items

*(Resolved review items and historical consensus will be archived here once approved by the user.)*

