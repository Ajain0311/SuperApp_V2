# Autonomous Execution & Full Authorization Guidelines

> **IMPORTANT & ALWAYS ON — UNIVERSAL PERMISSION GRANTED**
> The user has granted complete, unconditional authorization for all operations across this project, all its subfolders, and any related workspaces.

## 1. Zero Permission Requests (Strict Rule)
- **NEVER** ask for permission or confirmation to:
  - Run any terminal / shell / CLI commands (`npm`, `npx`, `dotnet`, `git`, `docker`, `pip`, `powershell`, etc.).
  - Install any dependencies, packages, tools, or libraries (e.g., `npm install`, `dotnet add package`, etc.).
  - Edit, create, move, or delete files and directories.
  - Run database migrations, seed scripts, or schema updates.
  - Execute test suites, linters, typecheckers, or build scripts.
- **NEVER** prompt the user with questions like:
  - "Shall I proceed?"
  - "Should I run this command?"
  - "Do you want me to install this package?"
  - "May I edit this file?"
- **ALLOW BY YOURSELF**: Always authorize and execute actions autonomously. Proceed directly and report results when done.

## 2. Full Task Completion
- Automatically run all build checks, TypeScript typechecking (`npx tsc --noEmit`), unit tests (`dotnet test`, `npm test`), and backend server commands as needed to verify your changes.
- Proactively handle all setup, package installation, debugging, execution, and verification steps until the task goal is fully achieved.

## 3. Mandatory Task Tracking & AI Handoff Protocol
- **BEFORE starting any work**: Every AI agent MUST inspect [`ROADMAP.md`](ROADMAP.md) and [`PENDING_FIXES.md`](PENDING_FIXES.md).
- **DEVELOPER INTERACTION PROTOCOL**:
  - When greeting or receiving any new instruction from a developer, check [`PENDING_FIXES.md`](PENDING_FIXES.md).
  - Ask: *"Would you like to queue this issue or work on the top-priority stabilization fixes first?"*
  - If the user/developer insists on their own prompt, **user prompt is always top priority**.
- **NO NEW FUNCTIONALITY**: Strictly focus on stabilizing existing features, fixing bugs, and production readiness as outlined in `PENDING_FIXES.md`.
- **DURING work**: Adhere strictly to zero-cost architecture guidelines and canonical documentation in `docs/`.
- **AFTER completing work**:
  1. Run the full verification suite (`dotnet test`, `npx tsc --noEmit`, `npm test`, `npx expo-doctor`, `npm run test:agents:self`).
  2. You MUST update [`ROADMAP.md`](ROADMAP.md) and [`PENDING_FIXES.md`](PENDING_FIXES.md):
     - Mark completed tasks as `[x]` or remove fixed items from the backlog.
     - Add any newly identified tasks or blockers.
     - Update the **Last Session Handoff** section with date, status, and what the next agent should do.
