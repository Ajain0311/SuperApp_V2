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
>    - `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj --no-build` (Must pass 67/67)
>    - `npx tsc --noEmit` (Must have 0 errors)
>    - `npm test -- --watchAll=false` (Must pass 73/73)
>    - `npx expo-doctor` (Must pass 18/18)
>    - `npm run test:agents:self` (framework self-tests; live runs are opt-in)
> 2. **Update this file (`ROADMAP.md`)**:
>    - Mark finished tasks with `[x]` and record verification details.
>    - Add any new tasks or blockers discovered during work.
>    - Update the **Last Session Handoff** section at the bottom.

---

## 📊 Current Project State & Health Baseline

| Verification Dimension | Health / Coverage | Status |
|---|---|:---:|
| **Live multi-agent API** | `e2e/agents/runner.js` (opt-in; not the old UAT scripts) | Replaced |
| **Agent self-tests** | 14 / 14 passing (`npm run test:agents:self`) | ✅ 100% PASS |
| **Backend Tests (.NET 10)** | 75 / 75 Tests passing (`SuperApp.API.Tests`) | ✅ 100% PASS |
| **Frontend Tests (Jest)** | 74 / 74 Tests passing (`__tests__/`) | ✅ 100% PASS |
| **TypeScript Typecheck** | Strict mode, 0 errors (`npx tsc --noEmit`) | ✅ CLEAN |
| **Expo Ecosystem Doctor** | 21 / 21 checks passed (`npx expo-doctor`) | ✅ HEALTHY |
| **Database Schema** | 28 PostgreSQL tables with 34 indexes & check constraints | ✅ VERIFIED |
| **Documentation** | 11 Canonical files in `docs/` (zero clutter, no obsolete archives) | ✅ CONSOLIDATED |

---

## 🎯 Next Priorities & Roadmap (Next Kya Karna Hai)

The tasks below represent the logical sequence of work remaining for production rollout. AI agents must pick from the highest-priority open task:

### Phase 0.5: Mapbox Maps & Place Search (In Progress / Shipping)
- [x] **MAP-01: Mapbox client + Dev Client foundation**
  - Install `@rnmapbox/maps` + `expo-dev-client`; configure `app.json` plugins + Android/iOS application ids.
  - `mapboxService` Geocoding search/reverse; shared `LocationMapPicker` (native map + web search fallback).
  - Wire Ride booking editable pickup/dropoff search; Saved Addresses lat/lng + search.
  - Backend `MapboxMapService` + `NetTopologySuite` package; `RidesController` uses `IMapService` (Mapbox when `MAP_PROVIDER=Mapbox`).
  - **Note**: Requires Dev Client rebuild (`npx expo prebuild` / `run:android`). Expo Go cannot load Mapbox native SDK. Tokens only in `.env`.
- [ ] **MAP-02: Live ride tracking map on ActiveRideScreen** (follow-up)
- [ ] **MAP-03: PostGIS / EF NetTopologySuite geography columns** (optional follow-up)

### Phase 1: Production Gateway & Secret Provisioning (Current Focus)
- [ ] **PROD-01: Production SMS Gateway Activation**
  - Verify live Punjab State e-Governance DLT SMS Gateway (`https://eapi.punjab.gov.in/smapi/sms`) with actual non-mock teleco delivery.
  - In `appsettings.Production.json`, confirm `EnableMasterOtpFallback: false` so that test OTP `123456` is disabled in production mode.
- [ ] **PROD-02: Easebuzz Live Merchant Credentials**
  - Switch `Easebuzz:Environment` from sandbox to `prod`.
  - Inject live production Merchant Key and Salt into environment variables (never commit to git).
  - Verify live UPI / NetBanking transaction flow and webhook callback signature verification.
- [ ] **PROD-03: Production Push Notification Credentials**
  - Configure Apple Developer Team ID, APNs Key, and bundle identifier for iOS remote push notifications.
  - Configure Google Firebase Cloud Messaging (FCM v1) credentials for Android push notifications.

---

### Phase 2: Mobile Production Builds & App Store Packaging
- [ ] **BUILD-01: Expo Application Services (EAS) Setup**
  - Initialize EAS Project (`npx eas init`).
  - Configure `eas.json` with production build profiles for Android (`app-bundle` .aab) and iOS (`archive` .ipa).
- [ ] **BUILD-02: Android Release Signing & Google Play Preparation**
  - Generate upload keystore via EAS credentials manager.
  - Verify Android permissions in `app.json`: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`.
  - Build Android App Bundle (`npx eas build --platform android --profile production`).
- [ ] **BUILD-03: iOS Distribution & TestFlight Preparation**
  - Provision iOS Distribution Certificate and Provisioning Profile.
  - Verify iOS Info.plist permission disclosure strings for location and notifications in `app.json`.
  - Build iOS Archive (`npx eas build --platform ios --profile production`).

---

### Phase 3: Infrastructure, Monitoring & Operations
- [ ] **OPS-01: Docker Production Deployment**
  - Test multi-stage Docker build using `backend/SuperApp.API/Dockerfile`.
  - Deploy ASP.NET Core 10 container behind Nginx reverse proxy with TLS 1.3 and WebSocket sticky upgrade for SignalR.
### Phase 3: Infrastructure, Monitoring & Operations
- [ ] **OPS-01: Docker Production Deployment**
  - Test multi-stage Docker build using `backend/SuperApp.API/Dockerfile`.
  - Deploy ASP.NET Core 10 container behind Nginx reverse proxy with TLS 1.3 and WebSocket sticky upgrade for SignalR.
- [x] **OPS-02: Health Check Endpoint for Deployment Validation**
  - Wired `/health` probe endpoint in `backend/SuperApp.API/Program.cs` verifying database connectivity.
- [x] **OPS-03: Automated CI/CD GitHub Actions Workflow & Zero-Downtime Rollback**
  - Created `.github/workflows/deploy.yml` with automated test suite execution on push to `main` and SSH remote deployment to Azure VM (`20.106.173.109`).
  - Implemented versioned release manager `scripts/manage.sh` with automated healthcheck probe and auto-rollback on failure.
  - Documented complete architecture, GitHub secrets, and operational manual in [`guide.md`](guide.md).

---

## 🏆 Completed Milestones

- [x] **Zero-Touch CI/CD Auto-Deployment**: Push to `main` automatically runs verification tests and deploys versioned builds (`releases/release_SHA`) to Azure VM with automatic healthcheck rollback and disk pruning (`.github/workflows/deploy.yml`, `scripts/manage.sh`, `guide.md`).
- [x] **Consolidated Canonical Documentation**: 11 clean docs in `docs/`, deleted all 23 obsolete reports and archived folders.
- [x] **Secret Sanitization**: Removed all hardcoded database credentials from scripts; dynamically read from `.env`.
- [x] **Master Playwright Live Browser Suite**: 15 form flows tested live against running Chromium with 100% HTTP 200 responses (`e2e/master_live_test.js`).
- [x] **Automated Full UAT Test Suite**: 48 end-to-end scenarios covering all 12 controllers and multi-role operations (`scripts/execute_full_uat.js`).
- [x] **Multi-Role Single-Identity Architecture**: Seamless switching between Customer, Driver, Restaurant Owner, Marketplace Seller, and Admin.
- [x] **Manual Address Entry**: Removed external india-pincode API / postal lookup; Saved Addresses form uses manual City, State, and PIN fields.
- [x] **Address Pin Persistence**: Set-default / update paths preserve `latitude`/`longitude` (column-scoped default update + frontend omits null coords).
- [x] **Web Bottom Tabs**: Fixed full-page refresh back to Home caused by custom `tabBarButton` `href` handling on React Native Web.
- [x] **Real-Time SignalR WebSockets**: Order tracking (`OrderStatusHub`), Ride telemetry (`RideTrackingHub`), and Chat (`ChatHub`).
- [x] **Database Schema Alignment**: 28 PostgreSQL tables in Supabase with foreign key indexes and status check constraints.
- [x] **Multi-User Real End-to-End Verification**: 58/58 scenarios passing across 9 distinct accounts (2 customers, 2 restaurant owners, 2 drivers, 2 marketplace sellers, 1 admin). Strict zero data leakage confirmed across all matrices (`scripts/multi_user_e2e_test.js`).

---

## 📝 Last Session Handoff

- **Date**: October 5, 2026
- **Status**: Captain food delivery dispatch and verified online food payment are wired on main. Easebuzz live merchant keys are still unset, so live charges stay blocked. Sandbox/mock verification is the working payment path.
- **Previous**: Production auto-deployment and auto-rollback pipeline on `20.106.173.109` / `https://makemytree.duckdns.org`.
- **Fixes Applied This Session**:
  1. **Discovered Server Disconnect**: Inspected Azure VM (`20.106.173.109`) via SSH key (`rockbuilder_key.pem`); identified that `superapp.service` was running out of `/opt/SuperApp_V2/dist`, which was never rebuilt or republished on manual `git pull`.
  2. **Automated Versioned Deployment & Auto-Rollback Engine**: Created [`scripts/manage.sh`](scripts/manage.sh) maintaining versioned releases in `/opt/SuperApp_V2/releases/release_SHA`, updating `dist` symlink, testing `/health` probe, auto-rolling back on failure, and pruning older releases.
  3. **Backend Health Check Probe**: Added native `/health` endpoint to [`backend/SuperApp.API/Program.cs`](backend/SuperApp.API/Program.cs) testing EF Core `CanConnectAsync()`.
  4. **GitHub Actions CI/CD Pipeline**: Added [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for automated deployments on push to `main` with `workflow_dispatch` manual rollback/deploy triggers.
  5. **Schema & Configuration Fixes**: Cleaned up [`app.json`](app.json) schema, validated git line endings via [`.gitattributes`](.gitattributes), and authored comprehensive operator manual in [`guide.md`](guide.md).
- **Verification Matrix**:
  - `dotnet test backend/SuperApp.API.Tests`: 75 / 75 PASS (100%)
  - `npm test -- --watchAll=false`: 74 / 74 PASS (100%)
  - `npx tsc --noEmit`: Clean (0 errors)
  - `npx expo-doctor`: 21 / 21 PASS (100%)
  - `npm run test:agents:self`: 14 / 14 PASS (100%)
- **Next Steps / Production Rollout Checklist**:
  1. Add GitHub repository secrets: `VM_HOST` (`20.106.173.109`), `VM_USER` (`azureuser`), and `VM_SSH_KEY` (from `rockbuilder_key.pem`).
  2. Commit and push changes to `main` to trigger the first fully automated CI/CD deployment run.
  3. Continue with Phase 1 gateways: Easebuzz live merchant keys and Punjab DLT SMS gateway activation.

