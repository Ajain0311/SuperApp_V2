# Changelog - React Native + Expo SuperApp

All notable changes in this migration project are documented below.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
