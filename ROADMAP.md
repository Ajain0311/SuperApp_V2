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
- **Status**: Completed FIX-17 (Lock down production environment, OTP_PROVIDER=PunjabGov, PAYMENT_PROVIDER=Easebuzz, blocked MockComplete in non-mock env with 403, hard check in MockOtpService) and FIX-16 (Replaced WebView Admin Panel with 100% Native React Native suite: AdminNavigator, AdminDashboardHome, AdminUsersScreen, AdminUserManageModal, AdminRestaurantsScreen, AdminDriversScreen, AdminOrdersScreen, AdminPaymentsScreen, and AdminSettingsScreen).
- **Active Bug Backlog**: Detailed task list in [`PENDING_FIXES.md`](PENDING_FIXES.md). All stabilization issues (FIX-01 to FIX-17) are now CLOSED.
- **Priority Tasks in `PENDING_FIXES.md`**:
  1. ~~FIX-01: Marketplace Item Sell Native Image Upload~~ [CLOSED]
  2. ~~FIX-02: Remove hardcoded sample/default data~~ [CLOSED]
  3. ~~FIX-03: Replace browser alerts with custom app modals~~ [CLOSED]
  4. ~~FIX-04: Image compression & thumbnail generation pipeline~~ [CLOSED]
  5. ~~FIX-05: Ride cancellation & food order state machine audit~~ [CLOSED]
  6. ~~FIX-06: Admin dashboard mobile/tablet responsive layout overhaul~~ [CLOSED]
  7. ~~FIX-07: Automated push notifications scheduler~~ [CLOSED]
  8. ~~FIX-08: Production hardening~~ [CLOSED]
  9. ~~FIX-09: Remove admin password prompt for demoted admins~~ [CLOSED]
  10. ~~FIX-12: Added forgot/reset password endpoints for admin~~ [CLOSED]
  11. ~~FIX-14: Vendor Dashboards UX & QA~~ [CLOSED]
  12. ~~FIX-15: SignalR Real-Time Testing & Hardening~~ [CLOSED]
  13. ~~FIX-16: Convert Admin Panel from WebView/HTML to Native React Native UI~~ [CLOSED]
  14. ~~FIX-17: .env & Backend runtime lockdown (OTP_PROVIDER=PunjabGov, PAYMENT_PROVIDER=Easebuzz)~~ [CLOSED]
- **Verification Suites**:
  - `dotnet test backend/SuperApp.sln`: 111 Passed / 111 Total
  - `npx tsc --noEmit`: 0 Errors
  - `npm test`: 14 Suites Passed, 82 Tests Passed
  - `npm run test:agents:self`: 14 Passed / 14 Total



