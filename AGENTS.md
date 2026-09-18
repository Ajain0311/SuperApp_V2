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
