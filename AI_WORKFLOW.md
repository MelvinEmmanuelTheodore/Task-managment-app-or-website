# Multi-AI Collaboration Workflow & Governance

## 1. Collaboration Roles & Responsibilities

To ensure clear ownership, avoid conflicting edits, and guarantee technical excellence, development is divided among three AI roles:

| Assistant | Primary Role | Responsibilities | Limitations |
|---|---|---|---|
| **Claude** | **Product Planner & Requirements Architect** | - Defines features, user stories, and acceptance criteria.<br>- Refines task workflows, routines, and domain-specific rules.<br>- Proposes feature enhancements for upcoming phases. | Does not directly write or commit production codebase files. |
| **ChatGPT** | **Independent Technical Reviewer & Auditor** | - Conducts architectural audits, security reviews, and edge-case analysis.<br>- Validates logic, state machines, and data schema consistency.<br>- Reviews code quality, test checklists, and debugging strategies. | Does not modify repository code directly. Suggestions must be logged in `REVIEW_QUEUE.md`. |
| **Antigravity** | **Primary Implementation Engineer & Git Operator** | - The sole assistant authorized to write, edit, and refactor code in the repository.<br>- Executes approved specifications and runs local builds, tests, and linting.<br>- Manages Git commits, branch hygiene, and remote synchronization. | Executes changes **only** after user approval. Never applies unconfirmed modifications. |

---

## 2. Decision & Approval Protocol
1. **Suggestions are NOT Decisions:** Proposing a feature or architectural change by Claude or ChatGPT does not make it an approved directive.
2. **Review Queue Log:** Any unresolved question, proposal, or disagreement must be recorded in [`REVIEW_QUEUE.md`](file:///m:/antigravity%20ide/Time%20managment%20app/REVIEW_QUEUE.md).
3. **User Authority:** The human user has final decision-making power. Antigravity will only implement changes once explicitly authorized by the user.
4. **Historical Record:** Every approved architectural or design decision is documented in [`DECISIONS.md`](file:///m:/antigravity%20ide/Time%20managment%20app/DECISIONS.md) with context and rationale.
5. **Phase Gate Enforcement:** Development strictly follows a phased delivery plan. No work on future phases will begin until the active phase is verified and signed off.

---

## 3. How Other AIs Access This Project
When collaborating with Claude or ChatGPT in web or desktop chats:
1. **GitHub Repository:** Direct them to examine the public GitHub repository:  
   `https://github.com/MelvinEmmanuelTheodore/Task-managment-app-or-website`
2. **Key Shared Files:** The following files serve as the ground truth of project state:
   - `PROJECT_BRIEF.md` — Scope and guiding principles.
   - `ARCHITECTURE.md` — Technical design, data model, and sync protocols.
   - `DECISIONS.md` — Rationale behind approved choices.
   - `PROJECT_STATUS.md` — Live checklist of completed and pending items.
   - `REVIEW_QUEUE.md` — Current review questions awaiting feedback.
   - `CHANGELOG.md` — Detailed record of modifications.
3. **Sharing Code & Logs:** When asking ChatGPT to audit code or Claude to refine a specification, copy and paste the relevant markdown document or source code snippet directly.

---

## 4. Git & Repository Management Rules
- **Branch Strategy:** Work primarily on `main` for standard Phase 1 progression. Feature branches (e.g., `feat/offline-sync`) should be created for experimental or major refactors.
- **Commit Granularity:** Commit at each completed step with descriptive, standard commit messages (e.g., `docs: establish multi-ai shared documentation suite`).
- **Secret Protection:** Never commit `.env`, `google-services.json` (with production secrets), or private API keys. Use `.gitignore` to prevent accidental credential leakage.

