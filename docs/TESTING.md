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
| **Agent framework self-tests** | `npm run test:agents:self` | Runner, reports, concurrency | Required in CI |
| **Live multi-agent API** | `npm run test:agents` | Opt-in against a running API | Not run in CI |

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

## 5. Multi-agent live API framework

The old `scripts/execute_full_uat.js` and `e2e/master_live_test.js` runners were removed. Frontend is not part of either command.

```bash
# Backend off, frontend off
npm run test:agents:self

# Backend on, frontend off, ADMIN_PASSWORD set
npm run test:agents
```
