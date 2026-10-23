# SuperApp V2 — Rapid Development & AI Agent Guide

> **Target Audience:** AI Coding Agents, Pair Programmers, and Developers.  
> **Philosophy:** Execution-first, lean code, high reliability, zero fluff.

---

## 1. Core Directives

1. **Working Branch:**
   - Always work on `dev`.
   - Never commit or merge into `main`.
   - Never trigger production deployment unless explicitly instructed.
2. **Pull-Before-Push Rule:**
   - Always run `git pull --rebase origin dev` prior to pushing any commit to remote.
   - Never push code to the VCS/GitLab repository (`vcs.e-connectsolutions.com`).
3. **No Test Files on `dev`:**
   - Do not commit or push test scripts, mocks, end-to-end testing runners, or synthetic test suites to `dev`.
   - Gitignore is configured to block `**/__tests__/`, `**/*.test.*`, `**/*.spec.*`, and `*.Tests/`.
4. **Lean Verification Standards:**
   - **Frontend:** Always run `npx tsc --noEmit` to verify type safety.
   - **Backend:** Always run `dotnet build backend/SuperApp.sln` to verify clean compilation.

---

## 2. Push Notification Architecture (Real Android & iOS)

### Pipeline Overview
```
Client (App.tsx / authStore)
    │
    ▼ (Fetch real token via expo-notifications)
ExponentPushToken[xxxxxxxxxxxxxx]
    │
    ▼ POST /api/notifications/device-token
Backend AppDbContext (UserDeviceTokens table)
    │
    ├─► Event: Buyer sends chat message / Customer requests ride
    │
    ▼ INotificationService.SendPushNotificationAsync / BroadcastRideToAllCaptainsAsync
PushNotificationDispatcherService
    │
    ▼ POST https://exp.host/--/api/v2/push/send
Expo Push Service (or FCM for direct FCM tokens)
    │
    ▼
Android Device (High priority channel 'ride-requests' or 'default')
    │
    ▼ User taps notification
App.tsx -> notificationService.handleNotificationResponse()
    │
    ▼ Deep-link to screen (DriverHome, MarketplaceChat, FoodOrderTracking, etc.)
```

### Critical Rules for Push Notifications
1. **Never generate synthetic tokens:** `notificationService.ts` must never return fake strings like `ExponentPushToken[DEV-...]`. If running in an unsupported simulator or Expo Go on Android SDK 53+, return `null` and do not register with backend.
2. **Channel Configuration:** Android requires notification channels with high importance for ride alerts. These are created dynamically via `setupNotificationChannels()`.
3. **Diagnostics Endpoint:** Inspect push status via `GET /api/notifications/diagnostics` (safe endpoint with zero credentials leaked).

---

## 3. High-Velocity Development Workflows

### How to Add an API Endpoint
1. Define Entity/DTO in `backend/SuperApp.API/DTOs/` or `Models/`.
2. Add EF Core mapping in `AppDbContext.cs` if new tables/properties are needed.
3. Implement controller action in `backend/SuperApp.API/Controllers/`.
4. Run `dotnet build backend/SuperApp.sln` to confirm 0 compilation errors.
5. In frontend: Add route to `src/constants/api.ts` and consumption in `src/services/` or feature store.
6. Run `npx tsc --noEmit` to verify TypeScript contracts.

### How to Handle Real-Time SignalR Updates
1. SignalR hubs live in `backend/SuperApp.API/Hubs/`:
   - `ChatHub`: Marketplace live messaging and typing indicators.
   - `OrderStatusHub`: Food delivery 5-stage status stream.
   - `RideTrackingHub`: Driver live coordinate broadcasting and trip status updates.
2. In frontend: Use `src/services/signalr.ts` to subscribe to events. Always handle reconnection smoothly.

---

## 4. Multi-Role Navigation & State

The app operates on a single user identity with multiple dynamically assignable roles:
- `CUSTOMER`
- `DRIVER` (Captain)
- `VENDOR` (Restaurant Owner)
- `SELLER` (Marketplace Seller)
- `ADMIN`

Role switching is managed by `src/store/roleStore.ts`:
- Switching role updates active navigation tabs in `src/navigation/TabNavigator.tsx`.
- Role verification guards ensure unauthorized users cannot access restricted tabs.

---

## 5. Verification Checklist Before Committing

- [ ] `npx tsc --noEmit` exits with 0 errors.
- [ ] `dotnet build backend/SuperApp.sln` exits with 0 errors.
- [ ] `git status` shows no test files or temporary scripts staged.
- [ ] No hardcoded passwords, tokens, or production secrets are exposed.
