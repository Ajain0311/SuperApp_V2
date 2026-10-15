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

- **Date**: October 15, 2026
- **Status**: Completed Actionable Stabilization & Reliability Fixes:
  - **Marketplace**: Verified backend listing ID check, failure alert with form persistence, duplicate submission prevention, local notification gating on confirmed creation, deduplication of custom/server items, and empty collection handling.
  - **Food & Restaurants**: Added graceful empty menu and restaurant empty states, explicit demo mode labeling for offline fallback fixtures, and preserved accurate item mappings.
  - **Payments**: Enforced server-authoritative order amount and ownership verification in `PaymentsController`, eliminated hardcoded ₹1 override, sanitized test cards and test checkout URLs from production `/kit` responses, preserved Easebuzz gateway architecture.
  - **Security & OTP**: Startup guard preventing `MockOtpService` from running in Production mode, verified OTP exception handling, validated device token formatting in notifications.
  - **Configuration**: Corrected `app.json` schema validation for SDK 57 (21/21 expo-doctor checks passed).
- **Active Bug Backlog**: Detailed task list in [`PENDING_FIXES.md`](PENDING_FIXES.md).
  - FIX-19: Easebuzz live dashboard & webhook verification `[BLOCKED_EXTERNAL_DEPENDENCY]`
  - FIX-20: Google Play Store upload checklist (.aab) `[BLOCKED_EXTERNAL_DEPENDENCY]`
- **Verification Suites**:
  - `dotnet test backend/SuperApp.sln`: 115 Passed / 115 Total (100%)
  - `npx tsc --noEmit`: 0 Errors (100% clean)
  - `npm test -- --watchAll=false`: 16 Suites Passed, 88 Tests Passed (100%)
  - `npx expo-doctor`: 21/21 checks passed (100% clean)
  - `npm run test:agents:self`: 14 Passed / 14 Total (100%)



