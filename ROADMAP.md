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
- **Status**: Completed FIX-18:
  - Fixed wrong OTP bypass in `authStore.ts` (eliminated dev session fallback for 6-digit inputs; invalid OTPs are strictly rejected).
  - Fixed data visibility on web: removed duplicate `/api/api/...` double routes in all native admin screens and added auto-stripping interceptor in `apiClient.ts`.
  - Stale `dev_jwt_token_` values are automatically purged in `authStore.checkAuth()`.
  - Updated `.env` and `Program.cs` to route directly to `azuredb` (`DATABASE_CONNECTION_STRING` prioritized over old Supabase pooler).
  - Added `http://localhost:8081` to `CorsAllowedOrigins` in `appsettings.Production.json`.
- **Active Bug Backlog**: Detailed task list in [`PENDING_FIXES.md`](PENDING_FIXES.md). All stabilization issues (FIX-01 to FIX-18) are CLOSED.
- **Verification Suites**:
  - `dotnet test backend/SuperApp.sln`: 111 Passed / 111 Total
  - `npx tsc --noEmit`: 0 Errors
  - `npm test`: 14 Suites Passed, 82 Tests Passed
  - `npm run test:agents:self`: 14 Passed / 14 Total



