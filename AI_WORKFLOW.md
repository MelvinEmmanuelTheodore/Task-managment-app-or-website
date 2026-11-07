# AI Collaboration Workflow & Governance

## 1. Collaboration Roles & Responsibilities

To ensure clear ownership, avoid conflicting edits, and guarantee technical excellence, development is divided among two AI roles and the human User:

| Participant | Primary Role | Responsibilities | Limitations |
|---|---|---|---|
| **ChatGPT** | **Architect, Technical Reviewer & Approval Authority** | - Reviews plans, architecture, data schemas, security, and edge-case resilience.<br>- Audits implementation code, state management, test coverage, and debugging strategies.<br>- Evaluates technical trade-offs and issues approval recommendations for milestones. | Does not directly write or commit repository files. Communicates via technical reviews. |
| **Antigravity** | **Sole Developer, Implementation Lead, Testing & Git Operator** | - The sole assistant authorized to write, edit, and refactor code in the repository.<br>- Executes approved specifications and runs local builds, typechecks, tests, and web exports.<br>- Maintains documentation, changelog, decision records, Git branches, and commits. | Implements changes **only** after explicit user approval. Never applies unconfirmed modifications. |
| **User** | **Final Decision-Maker & Manual Tester** | - Approves architectural decisions, specifications, dependencies, and milestone gates.<br>- Conducts manual functional testing in the browser and on physical Android devices.<br>- Arbitrates any design decisions. | Final authority on all code merged and all phase transitions. |

---

## 2. Decision & Approval Protocol

1. **Suggestions are NOT Directives:** Recommendations or proposals from ChatGPT do not become directives until reviewed and explicitly approved by the User.
2. **Review Queue Log:** Any active technical inquiry, audit finding, or architectural proposal is recorded in [REVIEW_QUEUE.md](REVIEW_QUEUE.md).
3. **User Authority:** Antigravity implements changes strictly upon user authorization. No unsolicited code modifications or dependency installations are permitted.
4. **Historical Record:** Every approved architectural or design decision is formally documented in [DECISIONS.md](DECISIONS.md) with context, trade-offs, and rationale.
5. **Phase Gate Enforcement:** Development strictly follows a phased delivery plan. No work on future phases (e.g. Milestone B) begins until the active phase/step (e.g. Step B0) is audited, verified, and signed off.
6. **Ground Truth:** The GitHub repository is the single shared source of truth. All reviews are performed against committed repository state.

---

## 3. How ChatGPT Accesses This Project

When collaborating with ChatGPT in web or desktop sessions:
1. **Private GitHub Repository:** The repository is **Private**:  
   `https://github.com/MelvinEmmanuelTheodore/Task-managment-app-or-website`  
   Because the repository is private, external AI web tools cannot fetch it anonymously. The user copies and pastes relevant documentation files or code snippets into chat sessions as needed, or references committed documents.
2. **Key Shared Documents:** The following documents serve as the authoritative project state:
   - [PROJECT_BRIEF.md](PROJECT_BRIEF.md) — Scope, problem statement, and requirements.
   - [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture, data contracts, and security rules.
   - [DECISIONS.md](DECISIONS.md) — Architectural decisions log.
   - [PROJECT_STATUS.md](PROJECT_STATUS.md) — Live progress tracker and phase checklists.
   - [REVIEW_QUEUE.md](REVIEW_QUEUE.md) — Technical review log and inquiry queue.
   - [CHANGELOG.md](CHANGELOG.md) — Chronological record of implemented changes.
   - [STEP_B0_PLAN.md](STEP_B0_PLAN.md) — Step B0 hardening specifications.
3. **Sharing Code & Logs:** When requesting an audit, provide ChatGPT with the specific document or source file alongside the relevant test outputs and commit hash.

---

## 4. Git & Repository Management Rules

- **Branch Hygiene:** Feature development and hardening occur on dedicated branches (e.g. `feat/topics-tasks-timetable`). Merges into `main` require full verification and user sign-off.
- **Commit Granularity:** Commits must be focused and accompanied by standard descriptive commit messages (e.g. `docs: update AI workflow to two-agent governance`).
- **Secret Protection:** Never commit `.env*` files (except `.env.example`), `google-services.json`, keystores, or private API credentials. Strict `.gitignore` rules prevent accidental leakage.
