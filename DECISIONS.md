# Design Decisions Log

This document records architectural choices, evaluation of alternatives, and implementation decisions.

> **Status Protocol:** All decisions remain **"Proposed — Awaiting User Approval"** until explicitly confirmed by the user.

---

## Decision 001 — Tech Stack
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

| Choice | Selected | Alternatives Considered | Reason |
|---|---|---|---|
| Framework | Expo (React Native) + TypeScript | Flutter, React Native CLI | Single codebase for Android + Web; fast iteration, built-in tooling. |
| Routing | Expo Router (file-based) | React Navigation manual config | Simpler structure, built-in deep linking, clean web URL routing. |
| State | Zustand | Redux Toolkit, Context API | Minimal boilerplate, hook-based, excellent TypeScript performance. |
| Database | Firebase Firestore | Supabase, Local SQLite only | Built-in real-time sync across mobile & web; generous free tier. |
| Auth | Firebase Auth (Google Sign-In) | Email/Password, Supabase Auth | Fast single-tap authentication; direct link to Firestore security rules. |
| Notifications | expo-notifications (local) | Push via FCM, Notifee | Works offline, requires no server backend in Phase 1. |
| Web Hosting | Firebase Hosting | Vercel, Netlify | Native integration with existing Firebase project and CLI. |

---

## Decision 002 — Development Build vs Expo Go
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Use Expo Go for initial Step 1 & Step 2 UI scaffolding, then transition to an **EAS Development Build** at Step 3 (Firebase & Notifications).

**Accurate Technical Distinctions:**
- **What Expo Go Can Do:** Basic local notifications (`scheduleNotificationAsync`), UI layouts, simple Zustand state, and standard web/mock workflows.
- **Why Development Build is Required:**
  1. Google Sign-In via native OAuth (`@react-native-google-signin/google-signin`).
  2. Native Firestore disk persistence (`@react-native-firebase/firestore`).
  3. Custom Android notification channels with sound/vibration overrides.
  4. Notification action buttons ("Start now", "Done").
  5. Exact alarm scheduling (`SCHEDULE_EXACT_ALARM`) and boot receivers.

---

## Decision 003 — Dual Firebase SDK Strategy
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Use `@react-native-firebase/firestore` (native Android SDK) on Android and `firebase/firestore` (JS modular SDK) on web, united under a shared service interface (`firestore.ts`).

**Offline Persistence Clarifications:**
- **Android:** Native SDK manages an on-disk SQLite/LevelDB cache. Pending writes survive standard process termination.
- **Web:** Configured with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` backed by IndexedDB. Multi-tab concurrency is handled cleanly.
- **Backup Reliance:** Because aggressive Android OEM task killers or cache resets can interrupt local queues, the local database is not treated as an absolute durability guarantee. **Manual JSON export/import serves as the definitive independent backup.**

---

## Decision 004 — Notification Sync & Rolling Window
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Align both **task generation** and **notification scheduling** to a unified **7-day rolling window**.

**Sync Mechanism:**
1. Background Firestore listeners do not run when the Android app is terminated.
2. Every time the app comes to foreground (`AppState === 'active'`), it performs a self-healing resync, reconciling server tasks with scheduled notification IDs.
3. Wake-up (`08:00`) and Wind-down (`22:45`) are registered as **repeating daily alarms** as a safety net if the user doesn't open the app for days.
4. The web dashboard displays a warning banner when editing a task due within 2 hours.

---

## Decision 005 — Android Alarm Delivery Mode
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval (Verification at Step 3.5)  

**Decision:** Utilize `delivery: 'alarmClock'` on Android `IMPORTANCE_HIGH` channels for time-critical alarms.

**Verification Status:** **UNVERIFIED on target physical hardware.**
- Documentation: Introduced in `expo-notifications` (Expo SDK 58, PR `#49687`).
- Fallback: If `expo-notifications` fails physical device wake tests (in Step 3.5), we will evaluate **Notifee** as the native alarm engine.
- Exact vs Best-Effort:
  - Exact (`alarmClock`): Bypasses Doze mode for `isFixed == true` tasks and daily wake-up/sleep alarms.
  - Best-Effort (`bestEffort`): Standard fallback if user rejects `SCHEDULE_EXACT_ALARM` permissions on Android 14+.

---

## Decision 006 — Routine Generation & Deterministic IDs
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Routine templates generate independent task instances for a 7-day rolling window using deterministic IDs:
`${sourceTemplateId}_${date}_${blockIndex}` (e.g. `default_weekday_2026-11-08_0`).

**Benefits:**
- Multi-device generation (e.g. opening web and mobile simultaneously) writes to identical document paths without generating duplicate tasks.
- Modifying a template never modifies past or completed tasks.
- Editing future generated tasks requires explicit user confirmation.

---

## Decision 007 — No Automatic Schedule Changes & Reopening Tasks
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** The system will never silently alter or delete tasks without user confirmation.

**Reopening Tasks:**
- Tasks marked `done` by mistake can be reopened back to `in_progress`.
- The deliberate reopen action preserves `actualStart` and `actualEnd` for time-tracking integrity.

---

## Decision 008 — Timestamp Storage (UTC) and Display (IST)
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** All timestamps stored in UTC `Timestamp`. Displayed and queried in IST (`Asia/Kolkata`, UTC+5:30). Date strings (`"YYYY-MM-DD"`) represent the IST calendar day.

---

## Decision 009 — Write-Once Actual Execution Times
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** `actualStart` and `actualEnd` are immutable once recorded, ensuring objective planned vs actual analysis.

---

## Decision 010 — Dual-Layer Task Validation
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Validate task properties both on the client before write and on the server via Firestore Security Rules (title length 1-200, valid priority/status enum, duration 5-480 min, `plannedEnd > plannedStart`).

---

## Decision 011 — Backup & Recovery Protocol
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Settings screen provides manual JSON Export and Import.
- **Safety Auto-Backup:** Triggering "Replace All" on import automatically creates and downloads a fresh safety backup of the existing state before replacement.
- **Rescheduling:** Alarms are flushed and rescheduled for the new 7-day window following import.

---

## Decision 012 — Physical Device Alarm Test Suite (Step 3.5)
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:** Step 3.5 requires passing a structured physical-device alarm checklist before building remaining Phase 1 features:
1. App in foreground (visual heads-up banner + sound).
2. App closed / swiped away.
3. Screen locked / device sleeping (Doze mode test).
4. Device reboot (verifying alarm persistence / foreground resync).
5. Battery Saver mode active.
6. Do Not Disturb active (verifying alarm-clock channel priority).

---

## Decision 013 — Costs & Phase 5 Architecture Route
**Date:** 2026-11-07  
**Status:** Proposed — Awaiting User Approval  

**Decision:**
- **Phases 1–4:** Run strictly on the **Firebase Spark (Free) plan** and **Expo EAS Free Tier** (15 Android builds/month; unlimited local builds). No credit card required.
- **Billing Alerts:** Set up a $0 or $5 budget alert on Google Cloud Console before entering any paid tier.
- **Phase 5 AI Assistant Route:** **UNDECIDED**. While Cloud Functions + Claude API is one path, alternatives (such as local on-device inference, Gemini free tier, or client-side BYOK with local storage) will be evaluated in Phase 5 without presuming the Blaze plan.
