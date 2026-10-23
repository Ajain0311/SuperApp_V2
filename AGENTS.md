# Execution-First Agent Guidelines (Fast Coding Mode)

> **ACTIVE MODE: EXECUTION-FIRST**
> Follow the user's latest direct task immediately without roadmap gatekeeping or heavy documentation overhead.

## 1. Direct Execution Rules
- Follow the user's latest direct task immediately.
- Do not read `ROADMAP.md`, `PENDING_FIXES.md`, or every file in `docs/` before starting.
- Read only the specific source files, callers, and configuration needed to implement the requested change.
- Do not ask whether the user wants to queue an issue or work on backlog items.
- Do not require roadmap updates, handoff reports, multi-agent workflows, or full verification after every change.
- Do not run all test suites, Expo Doctor, agent self-tests, or complete build pipelines by default.
- Prefer direct implementation over lengthy analysis and reports.
- Do not generate long audit reports unless specifically requested.

## 2. Fast Verification Mode
- Do not run full test suites by default.
- Use quick targeted checks only when needed to verify the specific code changed.
- Run broader tests only when explicitly requested or for high-risk changes.
- Never claim tests passed if they were not run.

## 3. Strict Project Boundaries
- Work on `dev` only. Never modify or merge into `main`.
- Never trigger production deployment unless explicitly requested.
- Do not modify Flutter source.
- Do not overwrite unrelated work or discard user changes.
- Do not commit or push automatically unless the user explicitly asks.
- **NEVER Push Test Files / Test Suites (Strict Rule):** Any AI agent (Grok, Antigravity, Gemini, Cursor, etc.) MUST NEVER push test suites, mock test files, `__tests__`, `backend/SuperApp.API.Tests/`, `e2e/`, or test reports to remote. Keep test artifacts strictly local or ignored.
- **Mandatory Pull-Before-Push Rule:** Any AI agent/tool MUST ALWAYS run `git pull --rebase origin <branch>` before pushing any code to remote to avoid rejected pushes or merge conflicts. Never push without pulling latest remote changes first.
- Never expose credentials or copy secrets into logs or documentation.
- Fast execution must never bypass authorization, payment verification, or financial safeguards.
