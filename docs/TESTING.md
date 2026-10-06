# SuperApp V2 — Automated Testing & Quality Assurance Guide

This guide describes the current verification commands for **SuperApp V2**. September 2026 browser and UAT script results stay in `docs/UAT_RESULTS.md`. Those runners were removed.

---

## 1. Quality Assurance Pyramid

```text
               ┌─────────────────────────────┐
               │  Live multi-agent API       │  npm run test:agents (opt-in)
               ├─────────────────────────────┤
               │  Agent framework self-tests │  npm run test:agents:self
               ├─────────────────────────────┤
               │  Static analysis & doctor   │  tsc and expo-doctor
               ├─────────────────────────────┤
               │  Backend and frontend unit  │  xUnit 89 and Jest 74 (5 Oct 2026)
               └─────────────────────────────┘
```

---

## 2. Test Execution Quick Reference

| Test Suite | Command | Coverage | Passing Threshold |
|---|---|---|:---:|
| **Backend Unit Tests** | `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj` | 89 tests on 5 Oct 2026 | 89/89 |
| **Frontend Unit Tests** | `npm test -- --watchAll=false` | 74 tests on 5 Oct 2026 | 74/74 |
| **TypeScript Static Check** | `npx tsc --noEmit` | Entire TypeScript codebase | 0 errors |
| **Expo Ecosystem Doctor** | `npx expo-doctor` | 21 checks on 5 Oct 2026 | 21/21 |
| **Agent framework self-tests** | `npm run test:agents:self` | Runner, reports, concurrency | Required in CI |
| **Live multi-agent API** | `npm run test:agents` | Opt-in against a running API | Not run in CI |

---

## 3. Backend Unit & Integration Tests (xUnit)

Located in `backend/SuperApp.API.Tests/`. Built with **xUnit 2.9**, **FluentAssertions 8.0**, and **Moq 4.20**.

### Test Suite Structure

Current files include `AuthTests`, `FoodDeliveryAndPaymentTests`, `FoodPricingTests`, `RideFareEngineTests`, `DriverTests`, `OrderIsolationTests`, `AdminOnboardingTests`, `DocumentImageTests`, `MultiRoleTests`, `AddressTests`, and `MapAndMarketplaceTests`. Older controller-named files listed in previous revisions are gone.

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

Overnight volume is `.github/workflows/overnight-testing.yml`. It runs hourly from 22:00 to 09:00 IST and on manual `workflow_dispatch`. Command: `npm run test:agents:volume -- --customers 100 --restaurant-owners 10 --captains 20 --sellers 20 --concurrency 25 --cleanup`. Reports are the `overnight-test-report-<run id>` artifact, kept 14 days. See `e2e/agents/README.md` for the secret names. The workflow requires those secrets and no longer rejects production DNS/IP hosts; the suite still mutates the target API database.
