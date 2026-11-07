# Design Decisions Log

This file records every important design decision made during development, including what was chosen, what alternatives were considered, and why.

---

## Decision 001 — Tech Stack

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

| Choice | Selected | Alternatives considered | Reason |
|---|---|---|---|
| Framework | Expo (React Native) + TypeScript | Flutter, plain React Native CLI | Expo gives faster setup, OTA updates, EAS build service, and web support from one codebase. TypeScript catches bugs before runtime |
| Routing | Expo Router (file-based) | React Navigation (manual) | Less config, automatic web URL support, standard Expo convention |
| State management | Zustand | Redux Toolkit, React Context, Jotai | Minimal boilerplate (~5 lines for a store), great TS support, no providers needed, works naturally with Firestore listeners |
| Database | Firebase Firestore | Supabase, local SQLite + custom sync, Realm | Built-in offline persistence + real-time sync. No backend code to write or maintain. Free tier generous for single user |
| Auth | Firebase Auth (Google Sign-in) | Email/password, Supabase Auth | Google Sign-in = one tap, no passwords to remember. Firebase Auth is tightly integrated with Firestore security rules |
| Notifications | expo-notifications (local) | Push via FCM, Notifee | Local scheduling is simpler, no server needed, works offline, sufficient for a personal alarm app |
| Web hosting | Firebase Hosting | Vercel, Netlify | Already using Firebase, one fewer account/service. Free tier is sufficient |

---

## Decision 002 — Development Build vs Expo Go

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Switch from Expo Go to an EAS development build at Step 3 (Firebase setup).

**Why:** Expo Go does not support:
- `@react-native-google-signin/google-signin` (native module)
- `@react-native-firebase/firestore` (native module)
- Custom notification channels
- Notification action buttons
- Exact alarm scheduling
- Boot-completed broadcast receiver

**Trade-off:** Development builds take ~10-15 min to compile on EAS servers (free tier), but after the first build, iteration is still fast because code changes use hot reload — you only rebuild when adding a new native module.

**EAS free tier limit:** 15 Android builds/month. During active development, use hot reload for code changes and only rebuild when adding native modules. Local builds (`eas build --local`) are unlimited.

---

## Decision 003 — Dual Firebase SDK Strategy (REVISED v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Use `@react-native-firebase/firestore` (native SDK) on Android and `firebase/firestore` (JS SDK) on web, behind a platform-specific file abstraction.

**Why the Firebase JS SDK alone is NOT sufficient for Android:**
The Firebase JS SDK requires IndexedDB for persistent offline caching. React Native does not provide IndexedDB. Without it, the JS SDK falls back to an **in-memory cache only** — meaning all offline writes are lost when the app is killed or restarted. This was verified against current documentation and community reports.

**Why `@react-native-firebase` on Android:**
- Uses the native Android Firebase SDK (Java/Kotlin)
- Offline persistence uses **SQLite** — durable, survives app kill and device reboot
- Pending offline writes are automatically synced when the app reopens with internet
- Persistence is enabled by default, no extra configuration needed

**How the abstraction works:**
- `firestore.native.ts` — imports from `@react-native-firebase/firestore` (auto-selected on Android)
- `firestore.web.ts` — imports from `firebase/firestore` (auto-selected on web)
- `firestore.ts` — exports a shared interface that both implementations satisfy
- Components import from `firestore` without knowing which SDK runs underneath
- Metro bundler handles the platform resolution automatically

**Previous approach (v1):** Use Firebase JS SDK everywhere. **Rejected** because offline writes on Android are not durable.

---

## Decision 004 — Sync Strategy (REVISED v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Real-time Firestore listeners when app is active. Foreground re-sync for notifications when app is opened/foregrounded. No background listeners.

**Key facts acknowledged:**
1. Firestore real-time listeners CANNOT run when the Android app is terminated
2. There is no way to update local notifications from a Firestore listener when the app is closed
3. If a task is edited on the web while the phone app is closed, the phone will not know until the app is reopened

**Notification sync strategy:**
1. Schedule notifications for a 7-day rolling window only
2. Every time the app opens or returns to foreground, pull fresh data from Firestore and reschedule all notifications
3. Show a warning on the web when editing a task due within 2 hours
4. Accept the limitation: if you cancel a task on web and don't open the phone app before alarm time, one stale notification will fire

**Optional enhancement for Phase 5:** FCM silent push via Cloud Functions to cancel/reschedule notifications server-side. Not built in Phase 1 because it requires the Blaze plan and adds significant complexity.

---

## Decision 005 — Android Alarm Strategy (REVISED v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Use `delivery: 'alarmClock'` for alarm-clock-grade exact timing. Fall back to `bestEffort` if the user denies exact alarm permission.

**Permission handling:**
- Android 12 (API 31): `SCHEDULE_EXACT_ALARM` declared in manifest, granted by default
- Android 13 (API 33): additionally requires `POST_NOTIFICATIONS` runtime permission
- Android 14+ (API 34+): `SCHEDULE_EXACT_ALARM` is **denied by default** on fresh installs. User must be guided to Settings → Alarms & reminders. No in-app dialog available.

**Why `SCHEDULE_EXACT_ALARM` over `USE_EXACT_ALARM`:**
- `USE_EXACT_ALARM` is auto-granted but **restricted by Google Play policy** to dedicated alarm clock and calendar apps
- This is a task management/reminder app, so Google Play would likely reject `USE_EXACT_ALARM`
- `SCHEDULE_EXACT_ALARM` is allowed for reminder/task apps

**Reboot handling:**
- expo-notifications registers `RECEIVE_BOOT_COMPLETED` automatically via its config plugin
- However, OEM battery managers (Xiaomi, Samsung, Huawei) may block this broadcast
- **Primary defense:** foreground re-sync on every app open — always reschedules from Firestore
- **Secondary defense:** battery optimization guidance screen with brand-specific instructions

**Early testing:** Step 3.5 in the build plan runs a real-device alarm test immediately after the development build is working, before building any other features.

---

## Decision 006 — Routine Templates vs Task Instances (REVISED v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Routine templates are separate from generated task instances. Templates generate tasks into a 3-day rolling window. Template changes never modify past or completed tasks.

**How it works:**
1. Templates define reusable daily blocks (e.g., "Default Weekday" with time blocks for career, learning, etc.)
2. When the app opens, a generation engine checks the next 3 days
3. For each day that doesn't have tasks from the template yet, it generates independent task documents
4. Each generated task has `isFromTemplate: true` and `sourceTemplateId` linking back

**Template change rules:**
- Past tasks: NEVER modified
- Today's completed/cancelled tasks: NEVER modified
- Today's unfinished tasks: user is shown a list and asked to confirm replacement
- Future generated tasks: user is shown a list and asked to confirm replacement

**Alternative considered:** Regenerate all future tasks automatically on template change. Rejected because it violates the "never change my schedule without confirmation" principle.

---

## Decision 007 — No Automatic Schedule Changes

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** The app NEVER moves, reschedules, deletes, or modifies any task without showing you exactly what will change and getting your explicit confirmation.

This applies to:
- Template changes affecting existing tasks
- Recurring task edits ("this instance" vs "all future")
- Phase 3 rescheduling suggestions
- Any bulk operation

---

## Decision 008 — Timestamp Storage and Display (NEW v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** All timestamps stored in UTC (Firestore Timestamp). Displayed in IST (Asia/Kolkata, UTC+5:30). The `date` field for queries is the IST date string.

**Date rollover handling:** A task with `plannedStart` at 2026-11-08T00:30:00 UTC is 2026-11-08T06:00:00 IST, so `date = "2026-11-08"`. But a task at 2026-11-07T20:00:00 UTC is 2026-11-08T01:30:00 IST, so `date = "2026-11-08"` even though UTC is still Nov 7.

**Why IST date string:** Queries like "show me today's tasks" need to match on a date field. Using the UTC date would show wrong results around midnight IST.

---

## Decision 009 — Write-Once Actual Times (NEW v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** `actualStart` and `actualEnd` are write-once fields. They cannot be overwritten by editing a task's planned times or other fields.

**Why:** If you start a task at 9:15 AM and later edit its planned start from 9:00 to 9:30, the actual start should still show 9:15. Planned vs actual comparison is only meaningful if actual times are immutable records of what really happened.

**Correction mechanism:** A separate "Adjust actual time" action (not the regular edit form) allows changing actual times with a required reason field. This will be useful for Phase 4 (time tracking reports).

---

## Decision 010 — Task Validation (NEW v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Enforce validation rules in the data service layer before any Firestore write.

**Rules:**
- `plannedEnd` must be after `plannedStart`
- `durationMin` must be 5–480 minutes
- Status transitions follow a state machine (e.g., `done` is terminal)
- Required fields: title, category, priority, date, plannedStart, durationMin
- Title: 1–200 characters
- `reminderMinutesBefore`: null or ≥ 0

**Why not Firestore Security Rules for validation:** Security rules can enforce basic checks, but complex validation (like status transition state machines) is difficult to express in the rules language. Client-side validation in the data service layer gives better error messages and catches issues before the write attempt.

---

## Decision 011 — Manual Backup in Phase 1 (NEW v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Add manual JSON export and import to the Settings screen in Phase 1.

**Why:** Firebase data is tied to your Google account. If you lose access to Google, or if the Firebase project is accidentally deleted, there is no recovery without a local backup. Weekly manual exports are insurance.

**Export format:** Standard JSON containing all tasks, routine templates, and settings. Human-readable, openable in any text editor. Named with the export date for easy identification.

**Import behavior:** Validates the schema, shows a summary of what will be imported, asks for confirmation, offers "Replace all" or "Merge" options.

---

## Decision 012 — Notification Channel Timing (NEW v2)

**Date:** 2026-11-07  
**Status:** Approved (pending user OK)

**Decision:** Create the Android notification channel BEFORE requesting `POST_NOTIFICATIONS` permission.

**Why:** On Android 13+, if no notification channel exists when `requestPermissionsAsync()` is called, the system prompt will not appear and the method immediately returns `denied`. This is an expo-notifications/Android quirk that is not well-documented.

---

*More decisions will be added as development progresses.*
