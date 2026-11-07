# Project Status

**Current Phase:** Phase 1 (Foundation & Setup)  
**Status:** In Progress — Step B1 (Dependencies & Config) Completed on `feat/topics-tasks-timetable` (Android Native Build Verification Pending; Step B0 Remains Unmerged with REV-018 Deferred)  
**Last Updated:** 2026-11-07  

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
  - [x] Interactive Daily Timetable (validation for HH:mm & 5-480m duration, date changes, shift confirmation dialogs, fixed commitment flags)
  - [x] Local Persistence & Concurrency (`AsyncStorageAdapter` transactional write queue, persistent theme settings, JSON backup export)
  - [x] Unit test suite (20 tests passing across `storage.test.ts`, `categoryRules.test.ts`, `milestoneA.test.ts`)
- [ ] **Step B0: Milestone A Hardening & Resilience** *(Implemented on `feat/topics-tasks-timetable`; 50 automated unit tests pass; Remaining `migrateVersion()` validation issue recorded as DEFERRED / KNOWN ISSUE REV-018; Step B0 remains unmerged into `main`)*
  - [x] 1. Write-lock on storage corruption, invalid envelopes, raw in-memory retention & recovery retry
  - [x] 2. Verified export with file existence/size validation, modern File/Paths API and `expo-sharing`
  - [x] 3. Settings import UI (`expo-document-picker`), deep schema validation, deterministic merge (`seconds` + `nanoseconds`), mandatory external backup export enforcement & internal rollback snapshot verification
  - [x] 4. Storage provider factory (`getStorage()`)
  - [x] 5. Removal of redundant `UserSettings.categories` & deep-copied initial data
  - [x] 6. Consolidated cascade and move logic in storage adapter returning updated envelope
  - [x] 7. Gapped sortOrder (multiples of 1024) with collapse re-normalization
- [ ] **Milestone B: Firebase, Cloud Sync & Google Auth**
  - [x] **Step B1: Dependencies, Config Plugins & EAS Dev Client Preparation** *(Dependency and configuration setup completed on `feat/topics-tasks-timetable`; `expo-dev-client@~58.0.18`, `@react-native-firebase/*@^27.1.0`, `@react-native-google-signin/google-signin@^17.0.0`, `firebase@^13.2.0`; `eas.json` created; Expo config validated; 50 tests pass; typecheck clean; web export clean; Android native compilation verification pending development build execution)*
  - [ ] **Step B2: Firebase Project Setup, Security Rules & Emulator Testing** *(Awaiting explicit user region confirmation and approval before creation; actual google-services.json and android.googleServicesFile to be configured here)*
  - [ ] **Step B3: Authentication Service & Auth Gate UI** *(Review Google Sign-In 17.0.0 Credential Manager consideration before implementation)*
  - [ ] **Step B4: Firestore Service Abstraction Layer**
  - [ ] **Step B5: Resumable Local-to-Cloud Migration & Replace-All Rollback**
  - [ ] **Step B6: Offline Sync, Real-Time Persistence & Conflict Resolution**
- [ ] Step 3.5: Early Real-Device Alarm & Reboot Verification *(Postponed to Milestone B native testing)*
- [ ] Step 7: Routine Templates & 7-Day Rolling Generation
- [ ] Step 8: Multi-View Task Lists (Daily, Weekly, Monthly)
- [ ] Step 9: Dashboard Timeline Integration
- [ ] Step 10: Task Execution Actions ("Start now", "Finish", "Reopen" with `actualHistory`)
- [ ] Step 11: Recurring Task Rules & Confirmation Dialogs
- [ ] Step 12: High-Priority Notifications & Action Buttons
- [ ] Step 13: Web Notification Warning Banner
- [ ] Step 14: End-to-End Cross-Device Sync Verification
- [ ] Step 15: Firebase Hosting Deployment (Web)
- [ ] Step 16: Final Polish & Production APK Generation

---

## 2. Immediate Blockers & Preserved Open Issues
1. **Deferred B0 Known Issue (REV-018):** The remaining edge-case validation in `migrateVersion()` is recorded as DEFERRED / KNOWN ISSUE per user instruction. Step B0 is not marked as fully approved and remains unmerged on `feat/topics-tasks-timetable`.
2. **Google Services File Timing:** The actual `google-services.json` file and the `android.googleServicesFile: "./google-services.json"` property in `app.json` will be added in Step B2 once the Firebase project has been created and the real configuration file is downloaded from the Firebase Console. Currently, the template `google-services.json.example` is checked in, and `.gitignore` ensures real credentials will not be leaked.
3. **Preserved Stage Blockers for Milestone B:**
   - **REV-019 (Step B2 Blocker):** Firestore history validation and append-only enforcement in Security Rules.
   - **REV-020 (Step B2 Blocker):** Real calendar-date validation in Security Rules (handling invalid leap years and out-of-range days).
   - **REV-021 (Step B5 Blocker):** Replace-All rollback safety, failure recovery, and audit session tracking.
   - **REV-022 (Step B1 Partially Verified):** Dependency and platform configuration completed and validated across TS, Expo config, and web export; Android native build verification (Gradle compilation / TurboModules codegen) remains pending development build execution.
   - **REV-023 (Step B3 Blocker / Consideration):** Review Google Sign-In 17.0.0 legacy Android SDK vs modern Android 14+ Credential Manager requirements and Play Services auth configurations before implementing `auth.native.ts`.
4. **Current Gate:** Step B1 dependency/config setup is complete. All automated checks (`npm test`, `npm run typecheck`, `npx expo config --type public`, `npx expo export --platform web`) pass cleanly. Waiting for review before proceeding to Step B2.
