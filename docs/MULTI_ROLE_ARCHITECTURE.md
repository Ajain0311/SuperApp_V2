# Unified Multi-Role Architecture — SuperApp

## 1. Executive Overview & Minimum-Cost Principle

The SuperApp uses a **Unified Multi-Role Application Architecture**. Rather than fragmenting the ecosystem into disparate driver, vendor, and citizen applications, a single React Native + Expo codebase dynamically adapts its user interface, workflows, and navigation tabs based on the user's authenticated roles and selected active mode.

```
+-------------------------------------------------------------+
|                  Unified SuperApp Mobile                    |
|             (React Native + Expo SDK 57)                    |
|  [Citizen]   [Driver]   [Vendor]   [Seller]   [Admin]       |
+------------------------------+------------------------------+
                               | HTTPS / WSS
                               v
+-------------------------------------------------------------+
|                  ASP.NET Core 10 Web API                    |
|          AuthController | DriverController | Vendor         |
|             SignalR RideTrackingHub & OrderHub              |
+------------------------------+------------------------------+
                               | EF Core Npgsql
                               v
+-------------------------------------------------------------+
|               Supabase Managed PostgreSQL                   |
|          Users <-> UserRoles <-> Roles (Join Table)         |
+-------------------------------------------------------------+
```

### Zero-Cost Compliance
This architecture adheres strictly to the project's zero-added-cost requirement:
- **No Redis / In-Memory Queues**: Native PostgreSQL database queries and SignalR group broadcasts handle all queueing and real-time state.
- **No RabbitMQ / Kafka**: SignalR WebSocket hubs (`/hubs/ride`, `/hubs/order`, `/hubs/chat`) provide instant push notifications for dispatch, arriving drivers, and order status transitions.
- **No Hangfire / Background Daemons**: Ephemeral background polling eliminated; state transitions occur via direct HTTP controller operations and SignalR hooks.
- **No Microservices / Secondary Identity DBs**: A single PostgreSQL database holds all identities, rides, food orders, and marketplace listings.

---

## 2. Role Model & Database Schema

The backend is the sole source of truth for user roles. Identities are unified under `Users`, with multi-role memberships modeled using the relational `UserRoles` join table:

```sql
-- Existing Identity Model
CREATE TABLE "Users" (
    "Id" SERIAL PRIMARY KEY,
    "MobileNumber" VARCHAR(20) NOT NULL UNIQUE,
    "FullName" VARCHAR(100),
    "IsActive" BOOLEAN DEFAULT TRUE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE "Roles" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE "UserRoles" (
    "UserId" INT REFERENCES "Users"("Id") ON DELETE CASCADE,
    "RoleId" INT REFERENCES "Roles"("Id") ON DELETE CASCADE,
    PRIMARY KEY ("UserId", "RoleId")
);
```

### Supported Roles
1. `CUSTOMER`: Citizen / standard consumer (Cab booking, food ordering, marketplace browsing).
2. `DRIVER`: Fleet driver (Duty toggle, available ride dispatch pool, trip navigation, OTP validation, earnings).
3. `RESTAURANT_OWNER`: Kitchen operator (Live incoming orders, kitchen queue status transitions, menu item management).
4. `MARKETPLACE_SELLER`: Merchant / peer seller (Listing creation, catalog management, inquiry notifications).
5. `ADMIN`: System platform administrator (Audit logs, platform KPIs, user moderation).

### Multi-Role Identity Examples
- Test Account `6375002348`: Assigned `CUSTOMER`, `DRIVER`, `RESTAURANT_OWNER`, and `MARKETPLACE_SELLER`. Can seamlessly switch between consumer, driver, kitchen, and merchant modes.
- Admin Account `9999999999`: Assigned `ADMIN` and `CUSTOMER`. Can manage platform operations or switch into customer mode to test user flows.

---

## 3. Security, Authorization & Token Lifecycle

1. **Authentication**: Users authenticate via OTP (`/api/auth/send-otp` and `/api/auth/verify-otp`) or Admin Login (`/api/auth/admin-login`).
2. **JWT Role Claims**: The backend generates standard JWT tokens containing user claims (`ClaimTypes.NameIdentifier`, `ClaimTypes.MobilePhone`, and multiple `ClaimTypes.Role` entries).
3. **Endpoint Protection**:
   - Driver endpoints (`/api/driver/*`): Secured with `[Authorize(Roles = "DRIVER,ADMIN")]`.
   - Vendor endpoints (`/api/vendor/*`): Secured with `[Authorize(Roles = "RESTAURANT_OWNER,ADMIN")]`.
   - User identity is resolved strictly from `User.FindFirst(ClaimTypes.NameIdentifier)?.Value`; drivers cannot impersonate other drivers.
4. **Client-Side Guarding**: The client stores available roles in `roleStore.ts`. If a user attempts to activate an unauthorized role, the store rejects the action and falls back safely to `CUSTOMER`.

---

## 4. Frontend State Management & Role Switching

### Zustand `useRoleStore` Architecture
- **State Properties**:
  - `activeRole`: Current active UI mode (`CUSTOMER | DRIVER | RESTAURANT_OWNER | MARKETPLACE_SELLER | ADMIN`).
  - `availableRoles`: Array of roles authorized for the authenticated user.
  - `hasMultipleRoles`: Boolean flag indicating if mode switching UI should be shown.
  - `isRoleSwitching`: Loading indicator during view transitions.
- **Persistence**: The active role is preserved in `AsyncStorage` (`superapp_active_role`). On app launch, `syncWithUserRoles` checks whether the saved role is still in the user's authorized role list; if not, it falls back to `CUSTOMER`.

### Dynamic Tab Navigation (`MainTabNavigator.tsx`)
Rather than maintaining separate navigation stacks, `MainTabNavigator` dynamically mounts role-specific tabs:
- **CUSTOMER Mode**: `Home`, `Ride`, `Food`, `Marketplace`, `Profile`
- **DRIVER Mode**: `DriverHome` (Duty & Active Trip), `DriverRides` (History), `DriverEarnings` (Financials), `Profile`
- **RESTAURANT_OWNER Mode**: `VendorDashboard` (KPIs), `VendorOrders` (Kitchen Queue), `VendorMenu` (Catalog), `Profile`
- **MARKETPLACE_SELLER Mode**: `SellerDashboard` (Sales & Listings), `Profile`
- **ADMIN Mode**: `AdminDashboard` (KPIs & Metrics), `Profile`

Every role tab bar retains the shared `Profile` screen, allowing one-tap access to the **Role Switch Modal**.

---

## 5. Automated Verification Summary

| Component | Test Suite | Tests Passed | Status |
|-----------|------------|--------------|--------|
| Backend API | `SuperApp.API.Tests` (`DriverTests.cs`, `MultiRoleTests.cs`, etc.) | 65 / 65 | PASS |
| Mobile Frontend | `Jest` (`roleStore.test.ts`, `driverService.test.ts`, etc.) | 71 / 71 | PASS |
| Static Types | `npx tsc --noEmit` | 0 errors | PASS |
| Expo Doctor | `npx expo-doctor` | 18 / 18 checks | PASS |
