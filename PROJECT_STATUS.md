# Project Status

**Current Phase:** Phase 1 (Foundation & Setup)  
**Status:** Timetable UI Improvements + Hosted PWA + Firebase Web Integration Completed on `feat/topics-tasks-timetable`  
**Last Updated:** 2026-11-08  

---

## 1. Overall Progress Tracker
- [x] Phase 1 Architecture & Specifications Approved by User (Decisions 001–004, 006–012 Approved; 005 Unverified; 013 Undecided)
- [x] Multi-AI Workflow & Documentation Governance Established
- [x] Environment Prerequisites Setup (Git & Node.js installed on host system)
- [x] Local Git Repository Initialized & Synced with Remote (`main` branch on GitHub)
- [x] Step 1: Expo React Native + TypeScript Project Scaffolding
- [x] **Milestone A: Interactive Core** (Completed & Audited on branch `feat/topics-tasks-timetable`)
  - [x] Category & Topic Manager (Full CRUD, priority editing, sortOrder reordering, active/deactivate toggle)
  - [x] Safe Category Deletion & Dependency Migration (accurate counts, cascade delete or move to another category)
  - [x] Topic Tasks (Full CRUD, title, priority, due date, notes editing, completion toggle, progress calculation)
  - [x] Dashboard with active topics grouped by category priority with pure presentational cards
  - [x] Interactive Daily & Weekly Timetable (Daily view with day-strip navigation, Weekly view with 7-day schedule & metrics, live conflict/overlap detection, topic & task linkages, completion status toggles [pending/completed/skipped], quick reschedule, strict start/end/duration synchronization and validation, explicit overnight block prevention, and local persistence)
  - [x] Next Activity Suggestions & Optional Recovery Rescheduling (dynamic identification of next pending block upon skip, conflict-free recovery slot finder later in the day, clear end-of-day wrap-up, and non-cascading advisory card)
  - [x] Populated "Week 1 - Initial Productivity Routine" (Monday 9 Nov – Friday 13 Nov 2026; 85 blocks; 17 blocks/day from 08:00 wake-up to 22:45 sleep prep; weekday variations for SolidWorks, ANSYS, Candidex, German, and constant LEGO McLaren P1; non-repeating)
  - [x] Local Persistence & Concurrency (`AsyncStorageAdapter` transactional write queue, persistent theme settings, JSON backup export)
  - [x] Unit test suite (94 tests passing across `storage.test.ts`, `categoryRules.test.ts`, `milestoneA.test.ts`, `stepB0.test.ts`, `timetable.test.ts`)
- [x] **Timetable UI Corrections & Enhancements**
  - [x] **A. Move Dialog:** Editable Date, Start Time, and Duration in minutes; auto-calculated End Time; real-time conflict detection using updated duration; preserves fixed commitment status (`isFixed: true`); strict overnight block prevention.
  - [x] **B. Dialog Positioning:** Lifts dialogs out of `ScrollView` into root viewport overlay via `<Modal>`; on web, enforced `position: 'fixed'`, centered viewport overlay (`zIndex: 99999`), internally scrollable dialog container, and document body scroll-locking while open.
  - [x] **C. Dynamic Category & Priority:** Dynamic display of category name, color, and resolved priority (`task.priority` -> `category.priority` -> `block.priority`) across both Daily cards (e.g. `Career · High`) and Weekly view (compact colored category-priority pill on every block).
- [x] **Progressive Web App (PWA) Configuration**
  - [x] Web App Manifest (`public/manifest.json`): name `Time Management App`, short name `Timetable`, standalone display mode, dark UI colors (`#111827`, `#1F2937`), Android icon sizes (192, 512, maskable), start_url & scope set to `/Task-managment-app-or-website/`.
  - [x] Service Worker (`public/sw.js`): Safe static shell precaching (cache-first for hashed static assets, network-first for HTML), complete passthrough for Firebase Auth & Firestore requests, self-updating (`skipWaiting`, `clients.claim()`).
  - [x] Custom HTML template (`app/+html.tsx`): Injects manifest, mobile meta tags, and automatic service worker registration on web build.
- [x] **GitHub Pages Automated Deployment**
  - [x] Base path `/Task-managment-app-or-website/` configured in `app.json` (`experiments.baseUrl`).
  - [x] GitHub Actions workflow (`.github/workflows/deploy-pages.yml`): automated build (`npx expo export --platform web`), SPA client-side routing fallback (`cp dist/index.html dist/404.html`), Jekyll bypass (`touch dist/.nojekyll`), and Pages deployment.
- [x] **Firebase Web SDK & Real-time Cloud Sync**
  - [x] Modular Firebase JS SDK integration (`firebase@^13.2.0`) targeting project `daily-tasks-a69b9` in region `asia-south1`.
  - [x] Google Sign-In with popup and redirect fallbacks (`src/services/auth/authService.ts`).
  - [x] Firestore multi-tab offline persistence (`persistentLocalCache`) and real-time synchronisation service (`src/services/sync/firestoreSyncService.ts`).
  - [x] Data Migration Modal (`src/components/DataMigrationModal.tsx`) prompting first-time sign-in users to batch-upload their local schedule (including 85-block routine) to Firestore.
  - [x] Strict security rules (`firestore.rules`) enforcing user-exclusive isolation under `/users/{userId}/...`.
  - [x] Settings screen UI integration: Cloud connection badge, user profile card, Google sign-in/out buttons, and manual migration trigger.

---

## 2. Platform Architecture: Android PWA vs Native Background Alarms
- **PWA Web Platform:**
  - Android Chrome allows installing the app directly from GitHub Pages as a standalone PWA with an app icon on the home screen.
  - Synchronises data with Firestore in real-time when online and caches locally when offline.
  - Web Push notifications are supported when the browser / service worker is active.
- **Background Alarm Limitations on Web:**
  - Standard web browsers cannot schedule exact wake-from-sleep alarms through Android's `AlarmManager` (`SCHEDULE_EXACT_ALARM`).
  - When the phone screen is locked or idle, Android's battery optimization (Doze mode) suspends web browser background processes.
  - In-app visual cues, reminders, and Web Push notifications fire reliably when the app or browser session is active, satisfying the current non-alarm notification requirement.

---

## 3. Preserved Open Issues & Governance
1. **Deferred B0 Known Issue (REV-018):** The remaining edge-case validation in `migrateVersion()` is recorded as DEFERRED / KNOWN ISSUE per user instruction. Step B0 remains unmerged on `feat/topics-tasks-timetable`.
2. **Main Branch Isolation:** All changes are maintained strictly on `feat/topics-tasks-timetable`. `main` remains untouched.
3. **Automated Verification:** All 94 unit tests (`timetable.test.ts`, `milestoneA.test.ts`, `stepB0.test.ts`, `categoryRules.test.ts`, `storage.test.ts`), TypeScript check (`tsc --noEmit`), and full web export (`expo export --platform web`) succeed with zero errors.
