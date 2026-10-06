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

---

## 📊 Current Project State & Health Baseline

| Verification Dimension | Health / Coverage | Status |
|---|---|:---:|
| **Live multi-agent API** | 6 Oct 2026 one-shot overnight-shaped volume on live DNS (`100/10/20/20`, c25, ~233s): PASS 72 / FAIL 79 / BLOCKED 3 / ERROR 43 (`run-muw72g1u`). Many OTP `500` and transport `0` under load; API health recovered. GitHub overnight secrets still need UI paste. | FAIL |
| **Agent self-tests** | 14 / 14 (`npm run test:agents:self`, 5 Oct 2026) | PASS |
| **Backend Tests (.NET 10)** | 105 / 105 (`dotnet test`, 5 Oct 2026) | PASS |
| **Frontend Tests (Jest)** | 74 / 74 (`npm test -- --watchAll=false`, 5 Oct 2026) | PASS |
| **TypeScript Typecheck** | 0 errors (`npx tsc --noEmit`, 5 Oct 2026) | PASS |
| **Expo Ecosystem Doctor** | 21 / 21 (`npx expo-doctor`, 5 Oct 2026) | PASS |
| **Food captain race** | In-memory `ConcurrentCaptains_OnlyOneAccepts` inside the 89. Postgres row-lock race not re-run. | PARTIAL |
| **Easebuzz live charge** | Sandbox path is in code. Production merchant keys are not set. | BLOCKED |
| **Real Android device** | Notch, GPS ride, and 3-role food delivery were not executed. | NOT TESTED |

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
- [x] **Historical browser and UAT runners**: September 2026 results stay in `docs/UAT_RESULTS.md`. Those scripts were removed. Current live checks are `e2e/agents/`.
- [x] **Food captain dispatch**: READY order can be accepted by one online captain, then pickup and deliver. Second accept is a conflict in the in-memory test.
- [x] **Online food payment verification**: Order is PAID only after server verification. Duplicate success sync stays one order. Live Easebuzz charge is still blocked.
- [x] **Admin role onboarding, coupons, banners**: Existing user can be assigned restaurant, captain, or seller. Coupons are validated on the server. Banners can upload a PostgreSQL image.
- [x] **Ride fare engine**: Server quotes bike, auto, and cab fares and stores the booked fare. Real-device GPS booking was not run.
- [x] **PostgreSQL image storage**: User images are compressed JPEGs in `documents`. Real gallery upload was not run.
- [x] **Multi-Role Single-Identity Architecture**: Seamless switching between Customer, Driver, Restaurant Owner, Marketplace Seller, and Admin.
- [x] **Manual Address Entry**: Removed external india-pincode API / postal lookup; Saved Addresses form uses manual City, State, and PIN fields.
- [x] **Address Pin Persistence**: Set-default / update paths preserve `latitude`/`longitude` (column-scoped default update + frontend omits null coords).
- [x] **Web Bottom Tabs**: Fixed full-page refresh back to Home caused by custom `tabBarButton` `href` handling on React Native Web.
- [x] **Real-Time SignalR WebSockets**: Order tracking (`OrderStatusHub`), Ride telemetry (`RideTrackingHub`), and Chat (`ChatHub`).
- [x] **Database Schema Alignment**: 28 PostgreSQL tables in Supabase with foreign key indexes and status check constraints.
- [x] **Multi-user isolation (historical)**: The old `scripts/multi_user_e2e_test.js` run is not the current suite. Isolation expectations now live in `e2e/agents/` and the xUnit order tests. A fresh live volume run was not executed on 5 Oct 2026.

---

## 📝 Last Session Handoff

- **Date**: October 6, 2026
- **Status**: Local one-shot overnight-shaped volume against live `https://makemytree.duckdns.org` completed in ~4 minutes (hard cap was 10). Run `run-muw72g1u`: 151 agents, concurrency 25, `--cleanup`. Result **FAIL** — PASS 72, FAIL 79, BLOCKED 3, ERROR 43. Dominant failures: OTP `send-otp`/`verify-otp` HTTP 500 and transport status 0 under burst load; DB verifier `ENOTFOUND` at end (cleanup blocked). Post-run `/health` still 200. `API_BASE_URL` for agents must be host-only (no `/api` suffix); secrets sheet + `e2e/agents/README.md` updated accordingly. GitHub Actions overnight secrets still need pasting in the UI before scheduled CI runs count.
- **See**: `e2e/agents/reports/latest.md` (`run-muw72g1u`), `.github/workflows/overnight-testing.yml`, `Desktop/SuperApp_V2/GITHUB_ACTIONS_SECRETS.md` (private, do not commit)
- **Verification Matrix (this session)**:
  - Live volume one-shot: FAIL (load/OTP/transport), AUTOMATED TESTED against production DNS by explicit user request.
  - Mini probe earlier (`1/1/1/1`): mostly PASS until session pooler `5432` max clients; transaction pooler `6543` used for volume DB env.
  - Full backend/Jest/tsc not re-run for this ops/docs pass.
- **Next priorities**:
  1. Paste overnight secrets (`API_BASE_URL=https://makemytree.duckdns.org` host-only) into GitHub Actions, then `workflow_dispatch` off-peak or with lower concurrency if live host stays the target.
  2. Investigate production OTP 500s / pooler pressure under concurrent `send-otp` (PunjabGov + DB).
  3. One real Android food order (customer, restaurant, captain) plus one GPS ride; Easebuzz sandbox before production keys.

