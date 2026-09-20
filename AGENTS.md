# Autonomous Execution & Full Authorization Guidelines

> **IMPORTANT & ALWAYS ON**
> The user has granted full, unconditional authorization for all operations in this workspace.

## 1. Zero Permission Requests
- **DO NOT** ask for permission or confirmation to execute terminal/shell commands (`dotnet test`, `dotnet build`, `npm test`, `npx tsc`, `git`, etc.).
- **DO NOT** ask for confirmation to edit files, create scratch files, update databases, or run test suites.
- Take all necessary actions autonomously and directly execute required commands.

## 2. Full Task Completion
- Automatically run all build checks, TypeScript typechecking (`npx tsc --noEmit`), unit tests (`dotnet test`, `npm test`), and backend server commands as needed to verify your changes.
- Proactively handle all setup, execution, debugging, and verification steps until the task goal is fully achieved.

## 3. Mandatory Task Tracking & AI Handoff Protocol
- **BEFORE starting any work**: Every AI agent MUST inspect [`ROADMAP.md`](ROADMAP.md) to understand current project health, completed milestones, and the immediate next priority tasks.
- **DURING work**: Adhere strictly to the zero-cost architecture guidelines and canonical documentation in `docs/`.
- **AFTER completing work**:
  1. Run the full verification suite (`dotnet test`, `npx tsc --noEmit`, `npm test`, `npx expo-doctor`, `node scripts/execute_full_uat.js`).
  2. You MUST update [`ROADMAP.md`](ROADMAP.md):
     - Mark completed tasks as `[x]`.
     - Add any newly identified tasks or blockers to the appropriate phase.
     - Update the **Last Session Handoff** section with date, status, and what the next agent should do.

