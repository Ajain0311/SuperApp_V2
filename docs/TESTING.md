# SuperApp V2 — Automated Testing & Quality Assurance Guide

This guide describes the comprehensive testing pyramid and automated verification suites for **SuperApp V2** (`HTTP-EXPNAT-NET`), covering backend unit tests, frontend component tests, static analysis, automated UAT runners, and live Playwright browser tests.

---

## 1. Quality Assurance Pyramid

```text
               ┌─────────────────────────────┐
               │    Live Browser E2E Tests   │  Playwright (15 flows, 36 APIs)
               │    (node e2e/master_live)   │
               ├─────────────────────────────┤
               │    Automated Full UAT       │  Node.js Axios (48 scenarios)
               │ (node scripts/execute_full) │
               ├─────────────────────────────┤
               │  Static Analysis & Doctor   │  TypeScript tsc & expo-doctor
               ├─────────────────────────────┤
               │  Backend & Frontend Unit    │  xUnit (67 tests) + Jest (73 tests)
               └─────────────────────────────┘
```

---

## 2. Test Execution Quick Reference

| Test Suite | Command | Coverage | Passing Threshold |
|---|---|---|:---:|
| **Backend Unit Tests** | `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj --no-build` | 67 tests in xUnit | 100% (67/67) |
| **Frontend Unit Tests** | `npm test -- --watchAll=false` | 73 tests in Jest | 100% (73/73) |
| **TypeScript Static Check** | `npx tsc --noEmit` | Entire TypeScript codebase | 0 errors |
| **Expo Ecosystem Doctor** | `npx expo-doctor` | 18 ecosystem health checks | 18/18 PASS |
| **Automated Full UAT** | `node scripts/execute_full_uat.js` | 48 end-to-end API scenarios | 100% (48/48) |
| **Live Playwright E2E** | `node e2e/master_live_test.js` | 15 live Chromium browser form flows | 100% (15/15) |

---

## 3. Backend Unit & Integration Tests (xUnit)

Located in `backend/SuperApp.API.Tests/`. Built with **xUnit 2.9**, **FluentAssertions 8.0**, and **Moq 4.20**.

### Test Suite Structure
- `AuthControllerTests.cs`: OTP generation, master OTP validation, invalid token rejection, admin credential login.
- `FoodOrdersControllerTests.cs`: Order creation, item subtotal calculation, GST tax computation, state transitions.
- `RidesControllerTests.cs`: Haversine distance calculations, multi-tier fare matrices, OTP security generation.
- `DriverControllerTests.cs`: Online/offline duty toggle, ride claiming, OTP handshake verification.
- `ReviewsControllerTests.cs`: Rolling average score calculation for restaurants and drivers.
- `VendorControllerTests.cs`: Kitchen state machine validation (`PENDING` -> `ACCEPTED` -> `PREPARING` -> `READY`).

### Running Backend Tests
```bash
# Run all backend tests
dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj --no-build
```

---

## 4. Frontend Component & Store Tests (Jest)

Located in `__tests__/`. Built with **Jest 29** and React Native test utilities.

### Test Suite Structure
- `stores/authStore.test.ts`: Login, OTP verification, fallback session handling, logout.
- `stores/roleStore.test.ts`: Role switching, unauthorized role rejection, role normalization.
- `stores/cartStore.test.ts`: Subtotal computation, addon addition, GST tax, single-restaurant cart isolation.
- `stores/marketplaceStore.test.ts`: Ad creation, favorite bookmarking.
- `services/apiClient.test.ts`: Axios interceptors, Bearer token injection, API error normalization.
- `services/signalr.test.ts`: WebSocket connection lifecycle, exponential backoff, room subscription.
- `services/locationService.test.ts`: Hardware GPS permission requests, fallback coordinates, Haversine formula.
- `integration/foodFlow.test.ts`: End-to-end food ordering sequence against simulated backend.
- `integration/rideFlow.test.ts`: End-to-end ride booking and OTP verification sequence.

### Running Frontend Tests
```bash
npm test -- --watchAll=false
```

---

## 5. Automated Full UAT Test Suite (`execute_full_uat.js`)

Located in [`scripts/execute_full_uat.js`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/scripts/execute_full_uat.js). This runner performs automated HTTP and WebSocket calls against the running ASP.NET Core 10 backend (`http://localhost:5000`):

### What It Tests:
- **Authentication (AUTH)**: OTP request, OTP verify, admin login, profile check.
- **Home & Discovery (HOME)**: Promotional banners, quick-action tiles.
- **Food Delivery (FOOD)**: Directory, menus, addons, cart, coupon validation (`WELCOME50`), order placement, cancellation.
- **Ride Hailing (RIDE)**: Haversine fare estimation, ride booking, active ride query.
- **Driver Portal (DRIVER)**: Duty toggle, dispatch pool query, ride acceptance, arriving status, OTP handshake, completion, telemetry stream, earnings.
- **Restaurant Vendor (VENDOR)**: Vendor profile, kitchen order queue, state transitions (`PENDING` -> `ACCEPTED` -> `PREPARING` -> `READY` -> `DELIVERED`), menu CRUD, category actions, store toggle.
- **Community Bazaar (BAZAAR)**: Category feed, listing query, ad publishing, ad reporting.
- **Reviews & Ratings (REVIEW)**: 1–5 star reviews for restaurants and drivers with rolling score updates.
- **Negative Security (SEC)**: Unauthenticated 401, customer attempting driver endpoint (403), customer attempting vendor order transition (403).

### Running Full UAT:
```bash
# Ensure backend is running on http://localhost:5000
node scripts/execute_full_uat.js
```

---

## 6. Live Playwright Browser Testing (`master_live_test.js`)

Located in [`e2e/master_live_test.js`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/e2e/master_live_test.js). This runner automates a real Chromium browser instance interacting with the live Expo Web frontend (`http://localhost:8081`):

### 15 Live Form Flows Executed:
1. **App Startup & Discovery Navigation**: Verifies landing page, banner carousel, and bottom tabs.
2. **Citizen Authentication & OTP Form**: Fills phone `6375002348`, submits OTP `123456`, asserts JWT storage.
3. **Food Restaurant Directory & Search**: Searches for cuisines, filters veg restaurants.
4. **Food Menu Browsing & Addon Customization**: Opens restaurant menu, selects dish variants, picks addons.
5. **Cart Management & Coupon Application**: Adds items, applies promo `WELCOME50`, verifies ₹100 discount.
6. **Order Placement Form**: Submits delivery address, confirms order placement.
7. **Order Tracking Stepper**: Verifies real-time order tracking stage indicator.
8. **Ride Fare Estimation Form**: Selects pickup & dropoff coordinates, verifies fare calculation for Bike/Auto/Cab.
9. **Ride Booking & OTP Verification**: Books ride, captures 4-digit start OTP.
10. **Community Bazaar Search & Filter**: Browses classifieds, tests category filters.
11. **Classified Ad Publishing Form**: Fills title, price, description, condition, submits ad.
12. **Ad Reporting Modal Form**: Tests citizen ad reporting workflow.
13. **Role Switcher Modal**: Switches active role between `CUSTOMER`, `DRIVER`, and `RESTAURANT_OWNER`.
14. **Driver Duty Toggle Form**: Driver toggles Online/Offline status on live duty dashboard.
15. **Admin Command Center Login & KPI Dashboard**: Direct admin authentication and metric verification.

### Running Playwright Tests:
```bash
# Ensure Backend (5000) and Expo Web (8081) are running
node e2e/master_live_test.js
```
