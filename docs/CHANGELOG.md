# Changelog - React Native + Expo SuperApp

All notable changes in this migration project are documented below.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-09-20

### Live Browser Testing, UAT Automation, Secret Sanitization & Documentation Consolidation
- **Master Live Browser E2E Automation**:
  - Implemented and executed `e2e/master_live_test.js` using Playwright Chromium against running Expo Web (`http://localhost:8081`) and ASP.NET Core 10 backend (`http://localhost:5000`).
  - Successfully verified **15/15 form flows**: Authentication OTP, Restaurant Search, Menu & Addon selection, Cart & Coupon redemption, Order Placement, Order Tracking Stepper, Ride Estimation, Ride Booking, Bazaar Search, Ad Publishing, Ad Reporting, Role Switching, Driver Duty Toggle, and Admin Command Center.
  - Recorded 36 live API network requests with **100% HTTP 200/201 success rate** and 0 browser console exceptions.
- **Automated Full UAT Test Suite**:
  - Created and executed `scripts/execute_full_uat.js` covering 48 comprehensive HTTP/SignalR test scenarios across all 12 backend controllers.
  - Verified restaurant vendor kitchen state transitions (`PENDING` -> `ACCEPTED` -> `PREPARING` -> `READY` -> `DELIVERED`), driver lifecycle, coupon validation, reviews rolling averages, and negative authorization tests (`SEC-01` through `SEC-05`).
  - Achieved **100% pass rate (48/48 scenarios)**.
- **Security & Secret Sanitization**:
  - Audited and sanitized utility scripts (`scripts/check-supabase.js`, `scripts/seed-food-all.js`, `scripts/seed-items.js`) to dynamically read database credentials from environment variables and `.env` instead of hardcoded strings.
  - Verified no plaintext passwords exist in active codebase.
- **Repository Audit & Documentation Consolidation**:
  - Audited full repository and established strictly the 11 canonical documentation references in `docs/`: `README.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `ROLES_AND_PERMISSIONS.md`, `DEVELOPMENT_SETUP.md`, `PRODUCTION_SETUP.md`, `TESTING.md`, `UAT_RESULTS.md`, `RELEASE_CHECKLIST.md`, and `CHANGELOG.md`.
  - Purged obsolete reports, duplicate audits, and unused test runners from repository.
  - Reorganized SQL files, centralizing migrations under `database/migrations/20260919_schema_audit_enhancements.sql`.
- **Quality & Test Verification**:
  - Backend xUnit tests: **67/67 passed** (100%).
  - Frontend Jest tests: **73/73 passed** (100%).
  - TypeScript static analysis: **0 errors** (`npx tsc --noEmit`).
  - Expo doctor audit: **18/18 checks passed** (`npx expo-doctor`).

---

## [2.2.0] - 2026-09-19

### Pre-UAT Complete Codebase Feature-Completion
- **Reviews & Ratings System**:
  - Implemented `ReviewDtos.cs` and `ReviewsController.cs` supporting target types `RESTAURANT`, `DRIVER`, and `LISTING`.
  - Automatic recalculation of rolling averages on target entities (`Restaurant.Rating`, `Restaurant.TotalRatings`, `Driver.Rating`, `Driver.TotalRides`).
  - Created `reviewService.ts` and `RatingModal.tsx` in frontend.
  - Linked `RatingModal` into `FoodOrderTrackingScreen.tsx` on delivery and `ActiveRideScreen.tsx` on trip completion.
- **Food Order State Machine & SignalR Integration**:
  - Enforced strict state transitions in `VendorController.cs`: `PENDING` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `READY` ➔ `DELIVERED` (or `CANCELLED`), rejecting invalid state skips with HTTP 400.
  - SignalR `OrderStatusHub` broadcasts `OrderStatusUpdated` over `$"order-{order.Id}"`.
  - Added category management action endpoint (`POST /api/vendor/categories`) supporting `ADD`, `EDIT`, and `DELETE`.
  - Added "Reject Order" button with confirmation and `CANCELLED` filter tab in `VendorOrdersScreen.tsx`.
- **Ride Flow & Real-Time Driver Dispatch**:
  - Injected `IHubContext<RideTrackingHub>` into `RidesController.cs`.
  - Broadcast `RideRequested` event to `drivers-pool` group on new ride booking.
  - Broadcast `DriverAssigned` and `RideStatusChanged` on trip status updates (`AcceptRide`, `MarkArriving`, `StartRide`, `CompleteRide`, `CancelRide`).
  - Added SignalR listener in `ActiveRideScreen.tsx` for dynamic driver assignment.
- **Bazaar Store & Ad Moderation**:
  - Implemented `POST /api/marketplace/listings/{id}/report` endpoint with auto-flagging.
  - Upgraded `ListingDetailScreen.tsx` with real API lifecycle, loading spinner, error retry, and report ad modal.
  - Upgraded `SellerDashboardScreen.tsx` with "Mark as Sold" toggle, delete action, and fixed `listingId` navigation.
- **Native Admin Command Center**:
  - Created `AdminDashboardScreen.tsx` with tabs for Overview (KPIs), Orders, Rides, Users (suspension toggle), Bazaar (moderation), and Config (settings & push broadcast).
  - Added admin endpoints: `food-orders`, `rides`, `marketplace/listings`, `settings`, `reports`, and `notifications/broadcast`.
  - Wired `AdminDashboardScreen` directly into `MainTabNavigator.tsx` for native admin experience.
- **Quality & Automated Test Verification**:
  - Backend unit tests: **67/67 passed** (100%).
  - Frontend Jest tests: **73/73 passed** (100%).
  - TypeScript typecheck: **0 errors** (`npx tsc --noEmit`).
  - Expo doctor: **18/18 checks passed** (`npx expo-doctor`).
  - Documentation: Created `docs/CODING_COMPLETION_AUDIT.md`, `docs/CODING_COMPLETION_REPORT.md`, `docs/FULL_UAT_TEST_PLAN.md`, and `docs/FULL_UAT_RESULTS.md`.

---

## [2.1.0] - 2026-09-19

### Unified Multi-Role Architecture, Driver Mode & Role Switching
- **Unified Multi-Role Architecture (Zero-Cost Infrastructure)**:
  - Maintained single React Native + Expo codebase dynamically adapting across `CUSTOMER`, `ADMIN`, `DRIVER`, `RESTAURANT_OWNER`, and `MARKETPLACE_SELLER` modes.
  - No added Redis, RabbitMQ, Kafka, Hangfire, microservices, or secondary databases.
  - Backend source of truth using existing relational tables (`Users`, `Roles`, `UserRoles`).
  - Pre-seeded multi-role test users: `6375002348` (Citizen, Driver, Restaurant Owner, Marketplace Seller) and `9999999999` (Admin, Citizen).
- **Backend Driver Controller & Real-Time Hubs**:
  - Implemented `DriverController.cs` with 12 endpoints: `profile`, `toggle-online`, `available-rides`, `active-ride`, `rides/{id}/accept`, `rides/{id}/arriving`, `rides/{id}/start` (4-digit OTP), `rides/{id}/complete`, `rides/{id}/cancel`, `location`, `history`, `earnings`.
  - Added `JoinDriversPool` and `LeaveDriversPool` to `RideTrackingHub.cs`.
  - Extended `VendorController.cs` with `toggle-status`, `menu`, and `earnings` endpoints.
- **Frontend Role Management & Mode Switching**:
  - Created `src/store/roleStore.ts` with Zustand, role normalization, unauthorized switch rejection, and local persistence via `AsyncStorage` (`superapp_active_role`).
  - Integrated `useRoleStore` synchronization in `authStore.ts` (`checkAuth`, `verifyOtp`, `adminLogin`, `logout`).
  - Built `src/components/RoleSwitchModal.tsx` modal for one-tap switching between authorized roles.
  - Updated `src/features/profile/ProfileScreen.tsx` with Mode Switcher card.
  - Updated `src/navigation/MainTabNavigator.tsx` to dynamically mount role-specific bottom tab bars without requiring app reload or re-login.
- **Driver Mode Mobile Implementation**:
  - Created `DriverHomeScreen.tsx`: Duty toggle, available rides queue, active trip card, 4-digit OTP start input, live status transitions, and passenger call action.
  - Created `DriverRidesScreen.tsx`: Trip history with status filter, fare breakdowns, and timestamps.
  - Created `DriverEarningsScreen.tsx`: Daily/weekly/total earnings KPIs and vehicle registration view.
  - Battery-conscious foreground GPS tracking via `expo-location` running only when online and in an active trip (`ACCEPTED`, `ARRIVING`, `STARTED`).
- **Vendor & Marketplace Seller Dashboards**:
  - Created `VendorDashboardScreen.tsx`, `VendorOrdersScreen.tsx`, and `VendorMenuScreen.tsx`.
  - Created `SellerDashboardScreen.tsx` for community bazaar merchants.
- **Comprehensive Quality & Automated Testing**:
  - Backend unit tests: **65/65 tests passed** (+10 tests in `DriverTests.cs` and `MultiRoleTests.cs`).
  - Mobile Jest tests: **12/12 suites, 71/71 tests passed** (+19 tests in `roleStore.test.ts` and `driverService.test.ts`).
  - TypeScript static typecheck: **0 errors** (`npx tsc --noEmit`).
  - Expo doctor: **18/18 checks passed** (`npx expo-doctor`).
- **Documentation**:
  - Created `docs/MULTI_ROLE_ARCHITECTURE.md`, `docs/DRIVER_MODE.md`, `docs/ROLE_SWITCHING.md`.
  - Updated `docs/UAT_TEST_PLAN.md`, `docs/UAT_RESULTS.md`, `docs/REACT_NATIVE_STATUS.md`, and `docs/REAL_IMPLEMENTATION_AUDIT.md`.

---

## [2.0.0] - 2026-09-19

### Full Application UAT, Real API Integration & Security Hardening
- **Dynamic OTP SMS Service Integration**:
  - Implemented `ISmsService.cs`, `PunjabGovSmsService.cs`, and `PunjabGovOtpService.cs` integrated with Punjab State e-Governance SMS gateway (`https://eapi.punjab.gov.in/smapi/sms`).
  - Implemented dynamic OTP code interpolation for template `1407177633307627182` with 3-minute validity.
  - Preserved non-production dev fallback master OTP `123456`.
  - Added unit test suite `PunjabGovSmsServiceTests.cs` (7 tests, all passing).
- **Admin Password Hash Self-Healing**:
  - Added automatic BCrypt reconciliation in `AuthController.AdminLogin` to heal legacy migration hash mismatches in Supabase PostgreSQL upon successful credential authentication.
- **Vendor Authorization Security Hardening**:
  - Enforced `[Authorize]` on `VendorController.cs` and removed insecure default fallback that assigned unmapped users to restaurant #1.
  - Replaced with strict `RestaurantUsers` mapping resolution and `Admin` role checks; unauthorized access returns HTTP 403/404.
- **Customer Promotional Banners API**:
  - Implemented `Controllers/BannersController.cs` exposing `GET /api/banners`.
  - Bound `HomeScreen.tsx` to display active promotional banners fetched live from Supabase `banners` table.
- **Customer Ride History API**:
  - Implemented `GET /api/rides` (`GetMyRides`) in `RidesController.cs`.
  - Connected `src/features/activity/ActivityScreen.tsx` to display real ride history from Supabase with status badges and timestamps.
- **Food Coupon Validation & Apply**:
  - Integrated live coupon validation (`POST /api/coupons/validate`) in `CartSummarySheet.tsx`, deducting discounts dynamically (verified with `WELCOME50`).
  - Passed `couponCode` through `RestaurantDetailScreen.tsx` to `POST /api/foodorders`.
- **Dynamic Home Screen Live Ride Card**:
  - Updated `HomeScreen.tsx` to only render the live tracking card when an active ride exists in `PENDING`, `ACCEPTED`, or `STARTED` status.
- **Comprehensive UAT Documentation**:
  - Created `docs/UAT_TEST_PLAN.md` covering 55 test cases across 10 functional modules.
  - Created `docs/UAT_RESULTS.md` with full classification: 51 Passed (Real API), 4 Passed (Mock/Dev Only), 0 Failed, 0 Blocked.
- **Quality & Health Verification**:
  - Backend tests: **55/55 tests passed** (`dotnet test`).
  - Mobile tests: **10 test suites, 52/52 tests passed** (`npm test`).
  - Static type checking: **0 errors** (`npx tsc --noEmit`).
  - Expo doctor: **18/18 checks passed** (`npx expo-doctor`).

---

## [1.4.0] - 2026-09-17

### Supabase Cloud Infrastructure Connection (`drhjfkqeiijdmyettumz`)
- **Supabase Target Infrastructure Mapped**:
  - Bound backend connection routing to target Supabase project `drhjfkqeiijdmyettumz`.
  - Direct PostgreSQL Host: `db.drhjfkqeiijdmyettumz.supabase.co` (Port `5432`).
  - Connection Pooler Host: `aws-0-ap-northeast-1.pooler.supabase.com` (Port `5432`).
  - S3 Storage Endpoint documented for future provider task: `https://drhjfkqeiijdmyettumz.storage.supabase.co/storage/v1/s3` (Region `ap-northeast-1`).
- **Secure Local Secrets Management**:
  - Initialized ASP.NET Core User Secrets (`UserSecretsId: c87933eb-3eec-4973-a4bc-9d7524e812f9`) in `SuperApp.API.csproj`.
  - Added support and priority for `ConnectionStrings__SupabaseConnection` environment variable pattern.
  - Zero plain-text credentials or passwords written to git or tracked project files.
- **Supabase Local Project Configuration**:
  - Initialized local Supabase configuration in active project `supabase/config.toml` (`project_id = "drhjfkqeiijdmyettumz"`).
  - Updated `.gitignore` to strictly exclude `.supabase/`, `supabase/.branches/`, and `supabase/.temp/`.
- **Database Schema & Execution Guardrails**:
  - Verified non-destructive idempotent schema in `database/SuperApp_Supabase.sql` (all 28 tables, snake_case parity with EF Core).
  - Maintained explicit stop condition: schema execution deferred to project owner in Supabase SQL Editor.
- **Automated Testing & Health**:
  - Added unit test for `ConnectionStrings__SupabaseConnection` resolution.
  - Backend tests: **47/47 tests passed**.
  - Mobile tests: **9 test suites, 50 tests passed**, `npx tsc --noEmit` (0 errors), `npx expo-doctor` (18/18 checks passed).
  - Source repository `HTTP-FLUTnNET`: 100% clean and untouched.

---

## [1.3.0] - 2026-09-17

### Backend Multi-Provider Support (PostgreSQL / Supabase, SQL Server, InMemory)
- **Standalone Active Backend Copied to `HTTP-EXPNAT-NET/backend`**:
  - Copied `SuperApp.API` and `SuperApp.API.Tests` to `D:\FREELANCER\HTTP-EXPNAT-NET\backend\` to guarantee complete independence from the read-only Flutter repository.
  - Source codebase `D:\FREELANCER\HTTP-FLUTnNET` remains 100% clean and untouched.
- **PostgreSQL / Supabase Support via Npgsql**:
  - Added package `Npgsql.EntityFrameworkCore.PostgreSQL` (v10.0.3) to `SuperApp.API`.
  - Added package `EFCore.NamingConventions` (v10.0.1) for automatic snake_case table and column name mapping (`users`, `roles`, `created_at`, etc.), perfectly matching `database/SuperApp_Supabase.sql`.
  - Configured provider-aware partial indexing on `User.Email` (`"email" IS NOT NULL` on Postgres, `[Email] IS NOT NULL` on SQL Server).
- **Environment-Driven Provider Triad in `Program.cs`**:
  - `DATABASE_PROVIDER=InMemory`: zero-dependency RAM database with automated `EnsureCreated()` seeding on startup.
  - `DATABASE_PROVIDER=SqlServer`: SQL Server driver with connection retry policy.
  - `DATABASE_PROVIDER=Postgres` / `PostgreSQL` / `Supabase`: Npgsql driver with retry policy and snake_case naming.
- **Push Token Registration Endpoint**:
  - Added `UserDeviceToken` entity model and `DbSet<UserDeviceToken>` (table #28).
  - Added `POST /api/notifications/device-token` in `NotificationsController.cs` for device push token persistence and updates.
- **Unit Testing & Diagnostics**:
  - Added `DatabaseProviderTests.cs` (10 tests) covering provider DI resolution, options generation, and device token operations.
  - Full .NET backend test suite passing: **46/46 tests passed**.
  - Verified live endpoint responses on `http://localhost:5000` for `GET /api/restaurants` and `POST /api/notifications/device-token`.
  - Mobile test suite passing: **9 test suites, 50 tests passed**, `npx tsc --noEmit` (0 errors), `npx expo-doctor` (18/18 checks passed).

---

## [1.2.0] - 2026-09-17

### Device Push Notifications & Real Device Geolocation
- **Expo Notifications Integration (`expo-notifications` ~57.0.19)**:
  - Created centralized `NotificationService` in `src/services/notificationService.ts`.
  - Configured Android `POST_NOTIFICATIONS` permission and iOS presentation options (alert, badge, sound).
  - Implemented `requestPermission()` and `getPermissionStatus()` handling `granted`, `denied`, and `undetermined` permission states.
  - Implemented `getExpoPushToken()` with safe handling for EAS project ID retrieval and fallback dev token identifier for simulators/local setups.
  - Inspected backend `SuperApp.API/Controllers/NotificationsController.cs` and added `registerDeviceTokenWithBackend(token)` with graceful 404 handling.
  - Implemented `scheduleLocalNotification()` supporting immediate delivery and delayed time-interval scheduling.
  - Implemented deep-link response routing via `handleNotificationResponse(response, navigationRef)` routing to `FoodOrderTracking`, `ActiveRide`, `ListingDetail`, or `Notifications`.
  - Built interactive Push Notification Tester panel (`__DEV__`) in `NotificationsScreen.tsx` for immediate triggering and routing validation.
  - Ensured subscription teardown on unmount in `App.tsx` and services to prevent memory leaks.
- **Expo Location Integration (`expo-location` ~57.0.18)**:
  - Created centralized `LocationService` in `src/services/locationService.ts`.
  - Configured Android `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and iOS `NSLocationWhenInUseUsageDescription`.
  - Implemented `checkPermission()`, `requestPermission()`, and `isLocationServicesEnabled()` (`Location.hasServicesEnabledAsync()`).
  - Implemented `getCurrentLocation()` with configurable timeout protection (Promise race with timer clearance), reverse geocoding to human-readable street addresses, and fallback coordinates (`28.6304, 77.2177`).
  - Implemented `watchLocation()` for foreground coordinate tracking with native unsubscribe teardown.
  - Maintained Haversine distance (`calculateDistanceKm`) with 1.25 urban road tortuosity factor and travel duration estimation (`estimateDurationMinutes`).
- **Ride Booking Screen Enhancement (`RideBookingScreen.tsx`)**:
  - Added "Use Current GPS" button and GPS status badge (`GPS Online` / `Locating...` / `GPS Denied`).
  - Connected device GPS to update pickup coordinates and reverse-geocoded address, dynamically re-querying `POST /api/ride/estimate` with customer coordinates.
  - Maintained strict separation between customer device pickup GPS and driver vehicle telemetry (driver updates remain exclusively on SignalR `/hubs/ride` in `ActiveRideScreen.tsx`).
- **Automated Testing & Health**:
  - Added unit test suites `__tests__/services/notificationService.test.ts` (14 tests) and `__tests__/services/locationService.test.ts` (12 tests).
  - Total automated test suite passing: **9 test suites, 50 tests passed**.
  - Verified `npx tsc --noEmit` (0 errors) and `npx expo-doctor` (18/18 checks passed).
  - Source repository `HTTP-FLUTnNET`: 100% clean and untouched.

---

## [1.1.0] - 2026-09-17

### Real Backend Integration & Hardening
- **ASP.NET Core Server Validation**:
  - Validated ASP.NET Core backend in `SuperApp.API` (`dotnet test` passed 36/36 tests; server runs on `http://localhost:5000`).
  - Executed live HTTP calls verifying `POST /api/auth/send-otp` (200 OK), `POST /api/rides/estimate` (200 OK), `GET /api/marketplace/categories` (200 OK), and `GET /api/marketplace` (200 OK).
- **Route Alignments & Bug Fixes**:
  - Corrected `FoodOrdersController` route from `/food-orders` (404) to `/foodorders` (200 OK) in `src/constants/api.ts`.
  - Fixed `FoodOrderTrackingScreen` invalid navigation target from `MainShell` to `MainTabs`.
  - Installed missing peer dependency `expo-font` required by `@expo/vector-icons`.
- **Feature Screen API Wiring**:
  - `FoodHomeScreen.tsx`: Connected `GET /api/restaurants` with dynamic category filtering and fallback.
  - `RestaurantDetailScreen.tsx`: Connected `GET /api/restaurants/{id}` for live menus and wired `POST /api/foodorders` with loading spinner.
  - `FoodOrderTrackingScreen.tsx`: Subscribed to SignalR `/hubs/order` for live `OrderStatusUpdated` events and wired `POST /api/foodorders/{id}/cancel`.
  - `RideBookingScreen.tsx`: Connected `POST /api/rides/estimate` for real live fare calculation and `POST /api/rides/book` for instant driver assignment.
  - `ActiveRideScreen.tsx`: Subscribed to SignalR `/hubs/ride` for `DriverLocationUpdated` and `RideStatusChanged`, display dynamic 4-digit ride OTP, and wired `POST /api/rides/{id}/cancel`.
  - `MarketplaceHomeScreen.tsx`: Connected `GET /api/marketplace/categories` and `GET /api/marketplace` with live item feed and `POST /api/marketplace/favorites/{id}`.
  - `ListingDetailScreen.tsx`: Connected `GET /api/marketplace/{id}` for live seller and item metadata.
  - `AddListingScreen.tsx`: Wired `POST /api/marketplace/listings` (`action: ADD`) to persist new items into backend DB.
  - `ActivityScreen.tsx`: Connected `GET /api/foodorders` and `GET /api/marketplace/my-listings`.
  - `NotificationsScreen.tsx`: Connected `GET /api/notifications`.
- **Data Source Transparency**:
  - Created `DataSourceBadge.tsx` to clearly indicate Live API Connected vs Demo Seed Data.
  - Hardened auth session fallback (`isFallbackSession: true`) for seamless development.
- **Verification Metrics**:
  - `npx tsc --noEmit`: 0 errors.
  - `npx expo-doctor`: 18/18 checks passed.
  - `npm test`: 7/7 test suites passed, 22/22 unit & E2E integration tests passed.
  - Source repository `HTTP-FLUTnNET`: 100% clean and untouched.

## [1.0.0] - 2026-09-17

### Added
- **Project Infrastructure**:
  - Initialized blank TypeScript Expo SDK 57 template in independent folder `D:\FREELANCER\HTTP-EXPNAT-NET`.
  - Configured strict TypeScript compiler options (`tsconfig.json`).
  - Added `.env.example` template for backend base URL, timeouts, and SignalR hub endpoints.
  - Configured robust `.gitignore` excluding node modules, Expo build artifacts, and private `.env` files.
- **Theme & Design Tokens**:
  - Implemented cohesive dark theme (`#0A0E21`), surface (`#141829`), primary orange (`#FF6B35`), secondary green (`#00C853`), and blue (`#2196F3`).
  - Implemented typography styles matching Flutter `app_text_styles.dart`.
  - Implemented 8pt spacing system and border radius tokens.
- **Core Common Components**:
  - `AppButton`: Reusable full-width or custom button with loading spinner.
  - `AppSearchBar`: Dark input with clear button and search icon.
  - `RatingBadge`: Star rating pill.
  - `VegBadge`: Square indicator with green/red dot.
  - `StatusBadge`: Dynamic status chip for food, rides, and marketplace items.
  - `PriceDisplay`: Currency formatting with strikethrough discount.
  - `EmptyState`: Placeholder for empty search and list queries.
- **Client State & Services**:
  - `storage.ts`: SecureStore (mobile) with AsyncStorage (web fallback).
  - `apiClient.ts`: Axios client with JWT bearer interceptors, timeouts, and error handling.
  - `signalr.ts`: Hub connection manager for Ride Tracking, Order Status, and Chat.
  - `locationService.ts`: Haversine formula with 1.25x urban tortuosity factor.
  - `paymentService.ts`: Payment simulation matching Flutter `PaymentService`.
  - `notificationService.ts`: In-app alert pub/sub matching Flutter `NotificationService`.
  - `authStore.ts`: Session management with token persistence, OTP verification, and admin bypass.
  - `cartStore.ts`: Food cart state with item total, 5% GST taxes, and free delivery calculation.
  - `marketplaceStore.ts`: Local ad creation and favorite bookmarks.
- **Screens & Navigation**:
  - `SplashScreen.tsx`: Animated rocket pulse and authentication check.
  - `PhoneEntryScreen.tsx`: +91 mobile input and OTP trigger.
  - `OtpVerificationScreen.tsx`: 6-digit PIN boxes with dev OTP hint `123456`.
  - `HomeScreen.tsx`: In-transit ride card, 50% off food banner, modules grid, and deals carousel.
  - `FoodHomeScreen.tsx`: Food discovery with search, category pills, filter chips, and restaurant cards.
  - `RestaurantDetailScreen.tsx`: Menu accordion, dishes, customization modal, and cart bar.
  - `ItemCustomizationSheet.tsx`: Portion radio buttons and add-on checkboxes.
  - `CartSummarySheet.tsx`: Order summary, item breakdown, taxes, and checkout button.
  - `FoodOrderTrackingScreen.tsx`: Delivery ETA card, 5-step status stepper, and driver info.
  - `RideBookingScreen.tsx`: Pickup/dropoff card, route metrics, mock map canvas, 3 vehicle tiers.
  - `ActiveRideScreen.tsx`: SOS button, start ride OTP `4829`, driver Amit Singh card, trip stepper.
  - `MarketplaceHomeScreen.tsx`: Community bazaar, category carousel, 2-column product grid, favorite toggle.
  - `ListingDetailScreen.tsx`: Paged image carousel, negotiable badge, highlights chips, seller card, offer modal.
  - `AddListingScreen.tsx`: Photo upload thumbnails, category picker, condition chips, and ad publisher.
  - `ProfileScreen.tsx`: User initials avatar, activity shortcuts, settings menu, and logout prompt.
  - `NotificationsScreen.tsx`: Grouped notifications with unread status indicators.
  - `ActivityScreen.tsx`: 3-tab history view (Food Orders, Rides, Marketplace).
  - `MainTabNavigator.tsx`: 4 bottom tabs matching Flutter shell navigation.
  - `RootNavigator.tsx`: Native stack navigator registering all 15 screens and modals.
  - `App.tsx`: NavigationContainer with CustomDarkTheme and StatusBar.
- **Documentation**:
  - Added `REACT_NATIVE_MIGRATION.md`, `REACT_NATIVE_ARCHITECTURE.md`, `REACT_NATIVE_CONFIGURATION.md`, `REACT_NATIVE_SCREEN_MAPPING.md`, `REACT_NATIVE_API_MAPPING.md`, and `REACT_NATIVE_STATUS.md`.

### Security
- Verified that original codebase `D:\FREELANCER\HTTP-FLUTnNET` remains strictly unmodified and untouched.
- Ensured zero git push commands executed.
