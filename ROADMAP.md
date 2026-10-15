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
- **Status**: Git Branch Strategy & Production Architecture Separation:
  - **Branch Architecture Established**:
    - `main`: Clean, stable, production-ready application branch. Hosts production deployment (`.github/workflows/deploy.yml`) and minimal CI checks. Direct pushes protected; merges via PR only.
    - `dev`: Primary active development & testing branch. Houses the complete codebase, multi-agent regression framework, continuous 24/7 Playwright browser suite (`.github/workflows/playwright-e2e-nonstop.yml`), and overnight volume testing (`.github/workflows/overnight-testing.yml`).
  - **VM Deployment Isolation**: Commits on `dev` do NOT trigger production VM deployments. `deploy.yml` is restricted to push events on `main`.
  - **Public Store Compliance Website**: Verified live Vercel website (`Ajain0311/superapp-website`) at `https://superapp-website-ashen.vercel.app` with 100% active HTTP 200 routes:
    - Privacy Policy: `https://superapp-website-ashen.vercel.app/privacy-policy`
    - Terms & Conditions: `https://superapp-website-ashen.vercel.app/terms-and-conditions`
    - Account Deletion: `https://superapp-website-ashen.vercel.app/delete-account`
    - Grievance & Contact: `https://superapp-website-ashen.vercel.app/contact`
- **Active Bug Backlog**: Detailed task list in [`PENDING_FIXES.md`](PENDING_FIXES.md).
  - FIX-19: Easebuzz live dashboard & webhook verification [BLOCKED_EXTERNAL_DEPENDENCY]
  - FIX-20: Google Play Store upload checklist (.aab) [BLOCKED_EXTERNAL_DEPENDENCY]
  - GitHub Branch Protection Rule on `main`: Block direct push, require PR & passing CI [MANUAL_ACTION_REQUIRED in GitHub Repo Settings]
- **Verification Suites**:
  - `dotnet test backend/SuperApp.sln`: 115 Passed / 115 Total (100%)
  - `npx tsc --noEmit`: 0 Errors (100% clean)
  - `npm test -- --watchAll=false`: 16 Suites Passed, 88 Tests Passed (100%)
  - `npx expo-doctor`: 21/21 checks passed (100% clean)
  - `npm run test:agents:self`: 14 Passed / 14 Total (100%)

