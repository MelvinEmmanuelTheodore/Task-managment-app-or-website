# Project Brief: Personal Productivity & Career Management System

## 1. Overview & Purpose
A cross-platform personal productivity dashboard operating across Android (primary mobile device) and Web (desktop browser).
The application is designed to keep daily routines structured, track multi-track job applications, measure planned vs actual task duration, intelligently reschedule missed activities, and trigger reliable alarms without relying on punitive streaks or rigid scheduling.

## 2. Key Objectives & Capabilities
- **Daily & Weekly Timetable:** Vertical interactive timeline with real-time indicators and dynamic progress tracking.
- **Job Application Tracking (Phase 2):** Dedicated workflows for domestic (India) and international (overseas visa/language) job hunting.
- **Skill & Portfolio Building:** Dedicated time blocks for technical learning, coding projects, and interview preparation.
- **Planned vs Actual Tracking:** Write-once actual execution timestamps to evaluate estimation accuracy without overwriting planned goals.
- **Intelligent Rescheduling (Phase 3):** Prompt-based buffer slot suggestions, conflict mitigation, and recovery modes. Automatic schedule shuffling without user confirmation is strictly prohibited.
- **Reliable Mobile Alarms:** High-priority Android notification channels, `delivery: 'alarmClock'` exact timing, foreground self-healing resyncs, and OEM battery optimization guidance.
- **AI Assistant (Phase 5):** Server-side natural-language task and application ingestion via Firebase Cloud Functions and Claude API. Zero frontend API key exposure.

## 3. Guiding Principles
1. **Reliable MVP First:** Prioritize rock-solid fundamentals before building automated or AI-assisted features.
2. **Explicit User Confirmation:** The application will NEVER alter the user's schedule without presenting affected tasks and requiring confirmation.
3. **Standalone Core:** The entire productivity suite must function seamlessly without the optional AI assistant.
4. **Actionable Feedback:** Provide constructive insights into time allocation rather than anxiety-inducing streaks or notification spam.
5. **Clean & Accessible UI:** High-contrast dark mode support, generous touch targets, and color-coded categorizations.

## 4. Phased Roadmap
- **Phase 1 (Current):** Dashboard, Timetable, Tasks, Manual Tracking, Notifications & Alarms, Firestore Sync, Web Deployment, JSON Backup/Recovery.
- **Phase 2:** Domestic (India) & Overseas Job Application Trackers.
- **Phase 3:** Intelligent Rescheduling, Buffer Allocation & Recovery Mode.
- **Phase 4:** Habit Tracking, Time Analytics, Weekly Reviews & Performance Reports.
- **Phase 5:** Serverless AI Assistant with Natural Language Extraction.

## 5. Multi-AI Collaboration Model
- **Claude:** Product planning, functional requirements, and feature design.
- **ChatGPT:** Independent architectural audit, code review, debugging, and verification.
- **Antigravity (Me):** Primary developer responsible for codebase implementation, maintenance, and Git operations upon user authorization.

