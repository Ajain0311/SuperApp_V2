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
>    - **Auto-Commit & Push:** Automatically `git commit` and `git push` changes without asking for permission.

---

## 📌 Last Session Handoff

- **Date**: October 16, 2026
- **Status**: Production-Readiness Security Audit, Vulnerability Elimination & Auth Hardening:
  - **Security Audit & Hardening Completed**:
    1. **Authentication Backdoor Removed**: Eliminated hardcoded `Admin@123` password override/self-healing bypass from `AuthController.cs`. Regression tested with non-matching passwords and DB hash preservation.
    2. **Production OTP DevOtp Leak Guard**: Enforced `DevOtp = null` strictly when `ASPNETCORE_ENVIRONMENT=Production` in both `SendOtp` and `ForgotPassword`.
    3. **JWT Production Enforcement**: Added startup validator in `Program.cs` requiring `JWT_SECRET` >= 32 characters and rejecting development fallback key in Production mode. Unified `TokenService` resolution with env vars.
    4. **Payment Gateway Authorization & Ownership Isolation**:
       - Added `[Authorize]` and current-user ownership validation to `PaymentsController.CreateOrder`, `VerifyPayment`, `MockComplete`, and `GetMyPayments`.
       - Enforced cross-user isolation: attempting to create orders or verify payments for another user returns HTTP 403 Forbidden.
    5. **Easebuzz Gateway Fail-Closed Hardening**:
       - Required exact amount parity between Easebuzz status response and database payment record (mismatch now fails closed to `FAILED`).
       - Eliminated unauthenticated JSON parsing fallbacks in `EasebuzzPaymentService.VerifyPaymentAsync`.
       - Enforced non-empty `_salt` and `_key` verification in callback hashes.
    6. **Production Provider Lockdown**:
       - Added production guards to `MockPaymentService` constructor and `Program.cs` preventing silent fallback to mock payments.
       - Enforced map provider checks preventing silent fallback in production.
       - Restricted CORS in production mode to configured `CorsAllowedOrigins`.
    7. **Credential Sanitization in Tracked Files**:
       - Removed plaintext DB credentials, Easebuzz merchant keys, and SMS gateway server keys from `appsettings.json` and `.env.example`, replacing them with template placeholders. Preserved local developer runtime credentials in untracked `.env`.
  - **Active Bug Backlog**: Detailed task list in [`PENDING_FIXES.md`](PENDING_FIXES.md).
    - FIX-19: Easebuzz live credentials (`PAYMENT_KEY`, `PAYMENT_SECRET`, live webhook callback setup in merchant dashboard) [BLOCKED_EXTERNAL_DEPENDENCY]
    - FIX-20: Google Play Store upload checklist (.aab) [BLOCKED_EXTERNAL_DEPENDENCY]
    - Android Native Device Testing: Physical device or AVD system image download for execution [BLOCKED_HARDWARE_DEPENDENCY]
  - **Verification Suites**:
    - `dotnet test backend/SuperApp.sln`: 126 Passed / 126 Total (100% across all 17 test suites, +11 new security tests)
    - `npx tsc --noEmit`: 0 Errors (100% clean)
    - `npm test -- --watchAll=false`: 16 Suites Passed, 88 Tests Passed (100%)
    - `npx expo-doctor`: 21/21 checks passed (100% clean)
    - `npm run test:agents:self`: 14 Passed / 14 Total (100%)
