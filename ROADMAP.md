# SuperApp V2 — Roadmap & AI Task Tracker

> 🤖 **MANDATORY PROTOCOL FOR ALL AI AGENTS & DEVELOPERS**
>
> **BEFORE WRITING OR MODIFYING ANY CODE:**
> 1. **Read this file (`ROADMAP.md`) first**: Check current project state, active priorities, and the immediate next task.
> 2. **Check canonical docs in `docs/`**: Adhere strictly to [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATABASE.md`](docs/DATABASE.md), [`docs/API.md`](docs/API.md), and [`docs/ROLES_AND_PERMISSIONS.md`](docs/ROLES_AND_PERMISSIONS.md).
> 3. **Zero-Cost Constraint**: Do NOT introduce paid third-party APIs (no Google Maps API, no Redis/RabbitMQ/Kafka clusters).
>
> **AFTER COMPLETING ANY CODE CHANGE:**
> 1. **Run full verification pipeline**:
>    - `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj`
>    - `npx tsc --noEmit`
>    - `npm test -- --watchAll=false`
>    - `npx expo-doctor`
>    - `npm run test:agents:self` (live `test:agents` is opt-in and must not target production)
> 2. **Update this file (`ROADMAP.md`)**:
>    - Mark finished tasks with `[x]` and record verification details.
>    - Add any new tasks or blockers discovered during work.
>    - Update the **Last Session Handoff** section at the bottom.
   - **Auto-Commit & Push:** Automatically `git commit` and `git push` changes without asking for permission.

---

## 📌 Last Session Handoff

- **Date**: October 10, 2026
- **Status**: Completed FIX-04 (Image Compression & Thumbnail Pipeline). The backend EF Core migration was generated and git auto-commit/push rule applied. Verified with `npx tsc --noEmit`, `npm test`, and `dotnet test`.
- **Active Bug Backlog**: Detailed task list with executable prompts created in [`PENDING_FIXES.md`](PENDING_FIXES.md). No new features allowed until existing bugs are resolved.
- **Priority Tasks in `PENDING_FIXES.md`**:
  1. ~~FIX-01: Marketplace Item Sell Native Image Upload (replace URL input)~~ [CLOSED]
  2. ~~FIX-02: Remove hardcoded sample/default data (default MacBook listing)~~ [CLOSED]
  3. ~~FIX-03: Replace browser alerts (`"makemytree.duckdns.org says"`) with custom app modals~~ [CLOSED]
  4. ~~FIX-04: Image compression & thumbnail generation pipeline~~ [CLOSED]
  5. FIX-05: Ride cancellation & food order state machine audit (prevent ghost deletions)
  6. FIX-06: Admin dashboard mobile/tablet responsive layout overhaul
  7. FIX-07: Automated push notifications scheduler (2-3 times daily)
  8. FIX-08: Production hardening (disable mock OTP & sandbox payment bypass)
- **Protocol for Developers/Agents**: Check `PENDING_FIXES.md` first; prompt developer before taking new requests to confirm queue vs. major fixes.



