# 🛠️ SuperApp V2 — Production Stabilization & Bug Backlog

> 📌 **DEVELOPER & AI AGENT PROTOCOL:**
> 1. **Zero New Features:** Do not introduce new functional features until this stabilization backlog is completely resolved.
> 2. **Priority Order:** Tasks are ordered by critical production impact.
> 3. **Prompt Delivery:** Each issue below contains an **Execution Prompt** ready for immediate agent assignment.
> 4. **Handoff & Pruning:** Once an issue is fixed, tested, and verified via the test suite, mark it `[x]` and remove/archive it from this list. Keep all `.md` files (`ROADMAP.md`, `PENDING_FIXES.md`) synchronized.
> 5. **Auto-Commit & Push:** Automatically `git commit` and `git push` changes immediately after tests pass, without asking for permission.
> 6. **New Incoming Issues:** If a developer asks for a new prompt/issue, clarify if it should be queued here first or if they want to fix the top-ranked major issues first.

---

## 📋 Summary Status Board

| ID | Issue Area | Priority | Status |
|---|---|:---:|:---:|
| **FIX-01** | Marketplace Item Sell: Native Image Upload & Cloud Storage (Replace URL Input) | P0 (Critical) | `[x] CLOSED` |
| **FIX-02** | Remove Default/Sample Data (Default MacBook item & Mock Listings) | P0 (Critical) | `[x] CLOSED` |
| **FIX-03** | Fix Browser Dialogs: Replace `"makemytree.duckdns.org says"` with Custom Modal | P1 (High) | `[x] CLOSED` |
| **FIX-04** | Image Compression & Thumbnail Pipeline (High Quality, Low Memory) | P1 (High) | `[x] CLOSED` |
| **FIX-05** | Ride Cancellation & Food Order State Integrity (Prevent Ghost Deletion) | P1 (High) | `[x] CLOSED` |
| **FIX-06** | Admin Dashboard Mobile & Tablet Responsive UI Overhaul | P2 (Medium) | `[x] CLOSED` |
| **FIX-07** | Automated Push Notifications (2-3 times daily engagement broadcast) | P2 (Medium) | `[x] CLOSED` |
| **FIX-08** | Production Hardening: Disable Mock OTP & Test Payment Gateways | P0 (Critical) | `[x] CLOSED` |
| **FIX-09** | Remove Admin Password Prompt for Demoted Admins | P1 (High) | `[x] CLOSED` |
| **FIX-10** | Admin Dashboard Premium UI/UX Overhaul | P2 (Medium) | `[x] CLOSED` |
| **FIX-14** | Vendor Dashboards UX & QA | P1 (High) | `[x] CLOSED` |
| **FIX-15** | SignalR Real-Time Testing & Hardening | P1 (High) | `[x] CLOSED` |
| **FIX-16** | Convert Admin Panel from WebView/HTML to Native React Native UI | P0 (Critical) | `[x] CLOSED` |
| **FIX-17** | .env & Backend: Remove ALL test/mock OTP and payment at runtime (production locked) | P0 (Critical) | `[x] CLOSED` |
| **FIX-18** | Security & Auth: Strict OTP rejection & URL / Database route hardening | P0 (Critical) | `[x] CLOSED` |
| **FIX-19** | Easebuzz Live Dashboard & Webhook Setup Guide & Hardening | P0 (Critical) | `[ ] OPEN` |
| **FIX-20** | Google Play Store Upload Checklist (.aab, Keystore, Permissions, Privacy Policy) | P1 (High) | `[ ] OPEN` |
| **FIX-21** | Ride Section: Rapido-style Minimalist UI, Fast Location Autocomplete & Pin-on-Map Modal | P0 (Critical) | `[x] CLOSED` |
| **FIX-22** | Marketplace Image Upload: Fix "Upload failed server encountered an error" | P0 (Critical) | `[x] CLOSED` |
| **FIX-23** | Remove Test Payment / Banners section from User Flow | P1 (High) | `[x] CLOSED` |
| **FIX-24** | Food Section: Fix missing food & restaurant images | P0 (Critical) | `[x] CLOSED` |
| **FIX-25** | Mapbox Dev Client Build Guard & Fallback | P1 (High) | `[x] CLOSED` |

---

## 🎯 Detailed Tasks & Execution Prompts

### FIX-01: Marketplace Item Sell - Native Image Upload & Cloud Storage
- **Problem:** Currently, when a user sells/lists an item in the marketplace, there is no file/camera image picker; the UI asks the user to manually enter an image URL.
- **Goal:** Add native camera/gallery image picker using `expo-image-picker`. Upload the image directly to the backend (`/api/documents/upload` or PostgreSQL image store) and attach the returned URL/ID to the listing.
- **Execution Prompt:**
  ```text
  Fix the marketplace item selling flow in SuperApp V2.
  1. Open the sell/create listing screen (e.g. `src/screens/marketplace/CreateListingScreen.tsx` or equivalent).
  2. Replace the manual "Image URL" text input with a native image selector using `expo-image-picker`.
  3. Allow users to select multiple photos from the gallery or take a picture with the camera.
  4. Implement upload to the backend endpoint so the binary image is stored on the server and generates a valid accessible URL.
  5. Provide a preview thumbnail with a delete/remove button before final listing submission.
  6. Run `npx tsc --noEmit` and `npm test` to verify.
  ```

---

### FIX-02: Remove Default / Sample Data (Default MacBook Listing)
- **Problem:** When opening the marketplace or listing creation, default sample items (like "MacBook Pro") appear hardcoded or pre-filled.
- **Goal:** Remove all hardcoded default items, pre-filled form fields, and sample mock data so that only genuine database records appear.
- **Execution Prompt:**
  ```text
  Audit and remove all mock/sample fallback data in the marketplace and item listing components:
  1. Search for hardcoded references such as "MacBook", "MacBook Pro", and static placeholder listing items in `src/screens/marketplace/` and `src/services/`.
  2. Ensure forms start with clean empty states rather than pre-populated dummy values.
  3. Ensure marketplace feeds render an elegant empty state component ("No items found") when database tables have 0 listings instead of falling back to mock MacBook cards.
  4. Verify with `npx tsc --noEmit`.
  ```

---

### FIX-03: Fix Browser Alert Dialogs ("makemytree.duckdns.org says")
- **Problem:** On web / WebView / Expo Web, default JavaScript `window.alert()` or `window.confirm()` shows an ugly popup stating `"your makemytree.duckdns.org says this: ..."`.
- **Goal:** Replace all native `alert()` calls across the entire frontend with a custom styled in-app modal, toast, or standard React Native `Alert.alert` abstraction.
- **Execution Prompt:**
  ```text
  Remove ugly browser alerts across the SuperApp V2 frontend:
  1. Search for all occurrences of raw `alert(`, `window.alert(`, and `confirm(` across `src/`.
  2. Implement/use an in-app custom Alert modal or Toast notification system (or custom AlertProvider) that renders styled React Native components inside the app viewport.
  3. Ensure that when API errors or validation errors occur, users see a branded SuperApp dialog rather than "makemytree.duckdns.org says".
  4. Verify `npx tsc --noEmit`.
  ```

---

### FIX-04: Image Compression & Thumbnail Pipeline (High Quality, Low Memory)
- **Problem:** Uploading full-resolution mobile camera images wastes server bandwidth, bloats database storage, and causes slow mobile feed rendering.
- **Goal:** Automatically compress images client-side before upload (using `expo-image-manipulator`) and/or server-side (using `SixLabors.ImageSharp`), generating a lightweight thumbnail alongside the compressed web-friendly image.
- **Execution Prompt:**
  ```text
  Implement an image compression and thumbnail generation pipeline:
  1. On the client side (before upload), use `expo-image-manipulator` to resize images (max width/height 1200px, JPEG quality 0.75-0.80).
  2. On the backend upload handler (C# ASP.NET Core), use `SixLabors.ImageSharp` to:
     - Strip EXIF metadata to reduce size.
     - Generate a standard 300x300 thumbnail and store both thumbnail URL and main image URL.
  3. Ensure marketplace, food items, and avatars load thumbnails in list views for fast, smooth scrolling.
  4. Run `dotnet test` and `npx tsc --noEmit` to verify.
  ```

---

### FIX-05: Ride Cancellation & Food Order State Integrity (Ghost Deletion Bug)
- **Problem:**
  - When a user requests a ride, and the driver accepts then cancels, the ride appears to completely disappear/delete instead of resetting to `SEARCHING` or marking as `CANCELLED_BY_DRIVER`.
  - Same check needed for food orders: if a captain cancels or restaurant rejects, verify that order records are never dropped from the database.
- **Goal:** Ensure ride and food order states are immutable audit logs. A driver cancellation must either re-dispatch to the driver pool or update status to `CANCELLED_BY_DRIVER` without deleting the record.
- **Execution Prompt:**
  ```text
  Audit and fix ride cancellation and food order state machine in `RidesController.cs` and `FoodOrdersController.cs`:
  1. Inspect `CancelRide` and `CancelOrder` endpoints in the backend. Ensure NO `db.Rides.Remove(ride)` or hard deletion is executed.
  2. If a driver cancels an accepted ride:
     - Transition ride status to `CANCELLED_BY_DRIVER` or reset `driver_id = null` and status back to `SEARCHING` so other drivers can pick it up.
     - Log cancellation reason, timestamp, and audit trail.
  3. Write comprehensive unit test cases in `SuperApp.API.Tests` for:
     - User requests ride -> Driver accepts -> Driver cancels -> Verify ride persists in DB and is accessible in ride history.
     - Food order -> Captain accepts -> Captain unassigns -> Verify order is NOT deleted and returns to READY queue.
  4. Run `dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj` and verify 100% pass.
  ```

---

### [x] CLOSED FIX-06: Admin Dashboard Mobile & Tablet Responsive UI Overhaul
- **Problem:** Admin dashboard pages (located in `backend/SuperApp.API/wwwroot/admin/` or React Admin) are broken on mobile/tablet viewports; tables overflow horizontally without scrolling, cards stack awkwardly, and buttons overlap.
- **Goal:** Overhaul CSS/styles with mobile-first responsive design, touch-friendly navigation drawer, scrollable data tables, and adaptive stat cards.
- **Execution Prompt:**
  ```text
  Overhaul Admin Dashboard responsiveness:
  1. Inspect `backend/SuperApp.API/wwwroot/admin/` HTML and CSS files.
  2. Add responsive viewport meta tags and CSS media queries (`@media (max-width: 768px)` and `@media (max-width: 1024px)`).
  3. Wrap all data tables (users, restaurants, drivers, rides, orders) in responsive horizontal-scroll containers (`overflow-x: auto; -webkit-overflow-scrolling: touch;`).
  4. Convert sidebar navigation to a collapsible hamburger drawer on mobile screens.
  5. Stack dashboard KPI cards in a 1-column or 2-column mobile grid.
  6. Test on mobile screen viewports (375px, 414px, 768px).
  ```

---

### FIX-07: Automated Push Notifications (2-3 Times Daily User Engagement)
- **Problem:** Users currently receive no scheduled notifications for daily offers, food reminders, or ride deals.
- **Goal:** Implement a lightweight, zero-cost scheduled background service (ASP.NET Core `IHostedService` / `BackgroundService` or cron job) that broadcasts 2-3 personalized notifications per day (e.g., lunch offers at 12:30 PM, dinner recommendations at 7:30 PM) via Expo Push Notification API.
- **Execution Prompt:**
  ```text
  Build automated daily push notification scheduler:
  1. Create a `PushNotificationSchedulerService : BackgroundService` in `SuperApp.API/Services/`.
  2. Schedule 2-3 broadcasts daily (e.g., Lunch Deals at 12:30 PM IST, Evening Rides at 6:00 PM IST, Dinner Specials at 8:00 PM IST).
  3. Fetch active user push tokens from the `user_device_tokens` table in `azuredb`.
  4. Batch-send push payloads using Expo Push Notification API (`https://exp.host/--/api/v2/push/send`).
  5. Include opt-out check (`notifications_enabled` in user settings).
  6. Verify unit tests and ensure service does not block application startup.
  ```

---

### FIX-08: Production Hardening: Disable Mock OTP & Test Payment Gateways
- **Problem:** The codebase still contains fallback test OTP (`123456`) and Sandbox Easebuzz payment return endpoints, which must be strictly gated or removed for live production launch.
- **Goal:** Enforce strict production mode where master OTP `123456` is impossible to use, real SMS OTP is mandatory, and payments use live merchant processing.
- **Execution Prompt:**
  ```text
  Hard-lock production security for OTP and Payments:
  1. In `AuthController.cs` and `SmsService.cs`, enforce that when `ASPNETCORE_ENVIRONMENT=Production` or `EnableMasterOtpFallback=false`:
     - Test OTP `123456` is strictly rejected with 401 Unauthorized.
     - Live SMS gateway is required.
  2. In `PaymentsController.cs` and `EasebuzzPaymentService.cs`:
     - Block test mock payment bypass when environment is Production.
     - Verify checksum/hash on Easebuzz payment callbacks before marking any order or ride as PAID.
  3. Add regression tests in `SuperApp.API.Tests` ensuring security bypasses fail in Production configuration.
  4. Run `dotnet test` and verify.
  ```

---

### FIX-14: Vendor Dashboards UX & QA
- **Problem:** The pages for Restaurant Owners, Ride Captains, and Marketplace Sellers need a UX audit and polish to match the new premium feel.
- **Goal:** Audit and overhaul the vendor/seller interfaces (both in-app and web dashboards) to ensure they are highly responsive, intuitive, and bug-free.
- **Execution Prompt:**
  ```text
  Overhaul vendor/seller UX:
  1. Inspect the screens/components for Restaurant Owners, Ride Captains, and Marketplace Sellers.
  2. Upgrade the styling, fix any layout bugs, and ensure a premium "heavy developer" feel.
  3. Verify with 
npx tsc --noEmit or 
npm test.
  ```

---

### [x] CLOSED FIX-15: SignalR Real-Time Testing & Hardening
- **Problem:** SignalR real-time connections (Ride tracking, Order status, Chat) need rigorous testing and stabilization to prevent dropped connections or missed events.
- **Goal:** Harden the SignalR hubs and client services. Ensure automatic reconnections work smoothly, state is synchronized upon reconnect, and comprehensive unit/integration tests cover real-time edge cases.
- **Execution Prompt:**
  ``text
  Harden and test SignalR:
  1. Review RideTrackingHub, OrderStatusHub, and frontend signalr.ts.
  2. Implement robust reconnect logic and state-sync.
  3. Write/update rigorous tests to verify real-time events.
  ``

---

## 🤖 Interaction Guideline for Agents & Developers

When anyone joins this project:
1. **Developer Greeting / Incoming Prompts:**
   - First ask: *"Hi! We have a curated list of existing production bug fixes in `PENDING_FIXES.md`. Would you like to fix the top-priority issues first, or should I queue your new task into the backlog?"*
2. **Priority Rule:**
   - If user/developer says "Fix top priority first" -> Pick the next `[x] CLOSED` task from `PENDING_FIXES.md`.
   - If user gives a direct command/preference -> **User request is always top priority**, execute immediately, and log any follow-ups in `PENDING_FIXES.md` and `ROADMAP.md`.
3. **Completion Rule:**
   - As soon as a task is fixed and all tests (`dotnet test`, `npx tsc --noEmit`, `npm test`) pass, change `[x] CLOSED` to `[x] CLOSED`, update `ROADMAP.md`, and clean the backlog.


---

### FIX-09: Remove Admin Password Prompt for Demoted Admins
- **Problem:** If a user is given an admin role, a `PasswordHash` is generated. When the admin role is later removed via the admin dashboard (`ManageUser` endpoint), the `UserRole` is deleted, but the `PasswordHash` remains. This can cause authentication confusion where the user might still be asked for an admin password on login.
- **Goal:** Ensure `PasswordHash` is explicitly cleared (`null`) when the `ADMIN` role is removed from a user.
- **Execution Prompt:**
  ```text
  Fix the demoted admin password prompt bug:
  1. In `backend/SuperApp.API/Controllers/AdminController.cs`, locate the `REMOVE_ROLE` action inside `ManageUser`.
  2. If the role being removed is `ADMIN` (check `role.Name == RoleNames.Admin`), explicitly set `user.PasswordHash = null;`.
  3. Verify `AuthController.cs` logic safely ignores users without the admin role.
  4. Run `dotnet test` to verify no regressions.
  ```

---

### FIX-10: Admin Dashboard Premium UI/UX Overhaul
- **Problem:** While basic mobile responsiveness was added (FIX-06), the admin dashboard still lacks a premium, polished professional aesthetic. The design feels basic, components lack proper elevation/shadows, and color contrast needs improvement for a modern web app.
- **Goal:** Perform a premium UI/UX overhaul of the admin portal (`backend/SuperApp.API/wwwroot/admin/`).
- **Execution Prompt:**
  ```text
  Implement a premium UI/UX overhaul for the Admin Dashboard:
  1. Edit `backend/SuperApp.API/wwwroot/admin/index.html` and associated CSS.
  2. Upgrade the typography hierarchy, spacing, and grid layouts.
  3. Implement modern glassmorphism or sleek dark-mode cards with refined box-shadows.
  4. Improve data tables with better padding, sticky headers, and alternating row colors.
  5. Add subtle CSS transitions/animations for hover states and modal dialogs.
  6. Ensure all inputs, buttons, and badges have a cohesive, premium brand language.
  ```

---

### FIX-16: Convert Admin Panel from WebView/HTML to Native React Native UI
- **Problem:** The Admin Portal (`AdminPortalScreen.tsx`) currently loads a raw HTML page inside a `WebView` component. This makes it look and feel like a website, not a native mobile app. Users get a browser-like experience with no native touch gestures, no native navigation, and no native components.
- **Goal:** Rebuild the entire Admin Panel as a **100% native React Native** app using the same API endpoints that the current HTML admin panel calls. Screens to build natively:
  - Dashboard (stats cards: users, orders, rides, revenue)
  - Users list + Manage user (roles, ban/unban)
  - Restaurants list + manage
  - Riders/Drivers list + manage
  - Orders list (food + ride)
  - Payments list
  - App Settings
  - Push notifications / Announcements
- **Execution Prompt:**
  ```text
  Convert Admin Panel to native React Native UI:
  1. Delete/repurpose `src/features/admin/AdminPortalScreen.tsx` — replace WebView with native screens.
  2. Create `src/features/admin/` directory with dedicated native screens:
     - AdminDashboardHome.tsx (KPI stats cards from /api/admin/analytics)
     - AdminUsersScreen.tsx (FlatList of user cards, search, filter by role)
     - AdminUserManageModal.tsx (role toggle, ban/unban, reset password)
     - AdminRestaurantsScreen.tsx
     - AdminDriversScreen.tsx
     - AdminOrdersScreen.tsx
     - AdminPaymentsScreen.tsx
     - AdminSettingsScreen.tsx
  3. All screens must use the existing backend REST API endpoints under `/api/admin/` with the Bearer token.
  4. Use React Navigation Stack for admin sub-navigation.
  5. Apply the existing AppColors theme (dark mode, #0A0E21 bg, #FF6B35 primary).
  6. Small card components, FlatList for data tables, premium native touch feel.
  7. Run `npx tsc --noEmit` and `npm test`.
  8. Commit and push.
  ```

---

### FIX-17: .env & Backend — Remove ALL Test/Mock OTP and Payment at Runtime
- **Problem:** Even after setting `EXPO_PUBLIC_SHOW_TEST_OTP=false` in `.env`, the underlying backend `MockOtpService` and `MockPaymentService` are still active because the `.env` file's `OTP_PROVIDER=Mock` and `PAYMENT_PROVIDER=Mock` values were pointing to dev/mock providers.
- **Goal:** Fully lock down the runtime to production-grade providers:
  - OTP: `PunjabGov` real SMS only
  - Payment: `Easebuzz` production gateway only
  - `.env` must have zero trace of `123456` or `Mock`
- **Execution Prompt:**
  ```text
  Lock down production environment completely:
  1. In `.env`, ensure: OTP_PROVIDER=PunjabGov, PAYMENT_PROVIDER=Easebuzz, TEST_OTP=<empty>, EXPO_PUBLIC_SHOW_TEST_OTP=false.
  2. In `backend/SuperApp.API/appsettings.json`, ensure Payment.Env=prod, Providers.Otp=PunjabGov, Providers.Payment=Easebuzz.
  3. In `MockOtpService.cs`, add a hard check: if OTP_PROVIDER != "Mock", throw an exception at startup to prevent accidental use.
  4. In `PaymentsController.cs`, verify MockComplete endpoint returns 403 when PAYMENT_PROVIDER != "Mock".
  5. Run `dotnet test` and confirm all production security tests pass.
  6. Commit and push.
  ```

---

### FIX-18: Security & Auth — Strict OTP Rejection & Database / URL Route Hardening
- **Problem:**
  1. Entering a wrong 6-digit OTP allowed entry into the application via a client-side dev fallback in `authStore.ts` creating a fake session (`dev_jwt_token_...`, `John Doe`).
  2. Because the fake session held an invalid JWT token, subsequent requests to protected routes failed with 401 Unauthorized, resulting in blank screens on web.
  3. All native Admin Portal screens had `/api/admin/...` paths while `apiClient.baseURL` already ended in `/api`, causing redundant `/api/api/...` double-path requests that returned HTTP 404 Not Found.
  4. Local `.env` still had `ConnectionStrings__SupabaseConnection` pointing to legacy Supabase pooler rather than migrated `azuredb`.
- **Solution:**
  1. Removed dev fallback in `authStore.ts` (`verifyOtp` and `sendOtp`); invalid OTPs now strictly reject and throw error.
  2. Added interceptor in `apiClient.ts` to automatically strip redundant `/api` prefixes, and updated all admin screen calls to `/admin/...`.
  3. Added stale dev token eviction in `authStore.checkAuth()` so invalid or dev tokens are immediately purged from storage.
  4. Updated `.env` and `Program.cs` PostgreSQL connection string resolution to prioritize `DATABASE_CONNECTION_STRING` and `DefaultConnection` pointing to `azuredb`.
  5. Added `localhost:8081` to production CORS allowed origins in `appsettings.Production.json`.

---

### FIX-19: Easebuzz Live Dashboard & Webhook Setup Guide & Hardening
- **Problem:** When customers pay via Easebuzz in live production, transactions must automatically mark orders/rides as `PAID` via server-to-server webhook callbacks. If the webhook URL or live API keys (`KEY` / `SALT`) are not configured on the Easebuzz merchant dashboard, money is deducted from user account but orders remain in `PENDING` state.
- **Goal:**
  1. Set up the exact Webhook callback URL in Easebuzz Merchant Dashboard (`https://dashboard.easebuzz.in`):
     - **Webhook S2S URL:** `https://makemytree.duckdns.org/api/payments/webhook`
     - **Browser Return URL (SURL / FURL):** `https://makemytree.duckdns.org/api/payments/easebuzz-return`
  2. Verify Live Merchant Keys:
     - Check `Key` (`92LYE7065`) and `Secret/Salt` (`9H758G8WF`) against live merchant portal.
     - Webhook payload calculates reverse SHA-512 checksum: `hash = SHA512(salt|status|udf10...udf1|email|firstname|productinfo|amount|txnid|key)`.
  3. All payment orders are currently capped at ₹1.00 (`finalAmount = 1.00m`) in `PaymentsController.cs` for safe real-money live testing without debiting full order amounts.

---

### FIX-20: Google Play Store Upload Checklist & Production Packaging (.aab)
- **Problem:** Play Store does not accept standalone `.apk` files anymore; it requires an Android App Bundle (`.aab`) with target SDK 34/35, signed keystore, explicit privacy policy disclosures, and location permission declarations.
- **Checklist & Implementation Steps:**
  1. **Build Artifact:**
     - Run `eas build -p android --profile production` to generate a production signed `.aab`.
  2. **App Details & Identifiers:**
     - Package name: `com.superapp.v2`
     - Version code & Version string in `app.json`.
  3. **Mandatory Store Policies & Consents:**
     - **Location Permission:** Declare foreground location (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`) for driver dispatch and ride tracking.
     - **Push Notifications:** Declare `POST_NOTIFICATIONS` for live order alerts.
     - **Privacy Policy URL:** Host a privacy policy (e.g. `https://makemytree.duckdns.org/privacy`) explaining phone number, GPS coordinates, and payment handling.
  4. **Google Play Console Release Track:**
     - Create app in Google Play Console.
     - Upload `.aab` to **Internal Testing** track first, test on 2-3 devices, then promote to Closed Testing / Production.

---

### FIX-21: Ride Section — Rapido-Style Minimalist UI, Fast Location Autocomplete & Pin-on-Map Modal
- **Problem:** "Find your ride" section feels heavy and cluttered. Inline map view slows down interaction and renders poorly without native dev client.
- **Goal:**
  1. Make the ride booking screen clean, lightweight, and fast like **Rapido**:
     - Large, crisp "Pickup" and "Drop" inputs at the top.
     - As user starts typing, display real-time autocomplete suggestions dropdown immediately.
     - Add a clean Map pin icon on the right side of the input that opens a lightweight **"Pin on Map" Modal**.
  2. In the modal:
     - Show draggable map / center pin to let users pick their exact location.
     - "Confirm Location" button updates the address text and coordinates and closes modal.
  3. Move heavy map preview into this modal so the main screen remains fast and responsive.

---

### FIX-22: Marketplace Image Upload — Fix "Upload failed server encountered an error"
- **Problem:** When trying to sell/list an item in Community Marketplace and uploading an image, user gets an error: *"Upload failed server encountered an error"*.
- **Goal:**
  1. Inspect the upload flow in `src/features/marketplace/AddListingScreen.tsx` and the backend `DocumentsController.cs` / `AzureBlobStorageService.cs`.
  2. Verify if multipart form-data payload format, headers, file size limits, or storage directory permissions are causing 500 Internal Server Error.
  3. Ensure images are resized/compressed via `expo-image-manipulator` before uploading so payloads stay under 2MB.
  4. Ensure backend falls back gracefully to local disk `wwwroot/uploads` or DB blob storage if cloud storage is unconfigured.

---

### FIX-23: Remove Test Payment & Redundant Banners From User Flow
- **Problem:** App still has Payment Test screen / banner entry points visible in user profile or settings.
- **Goal:**
  1. Remove `PaymentTestScreen` navigation entry points from `ProfileScreen.tsx` and user menus.
  2. Remove mock payment banner shortcuts so end-users only see real checkout during actual food orders and ride completions.
  3. Keep Easebuzz production flow active; merchant checks will be done directly in Easebuzz live portal (`https://dashboard.easebuzz.in`).

---

### FIX-24: Food Section — Fix Missing Food & Restaurant Images
- **Problem:** Restaurant and dish images in Food section fail to load or show blank placeholders.
- **Goal:**
  1. Audit restaurant image URLs and food item image URLs returned from `/api/restaurants` and `/api/foodorders`.
  2. Check for broken external Unsplash links, HTTP vs HTTPS mixed content blocks, or local `/uploads/` relative paths lacking the host prefix.
  3. Implement automatic image URL resolver (`resolveImageUrl(url)`) with a high-reliability fallback CDN placeholder for broken links.

---

### FIX-25: Mapbox Dev Client Build Guard & Fallback
- **Problem:** Native `@rnmapbox/maps` requires an Expo Dev Client / EAS Prebuild binary. Running in standard Expo Go or without native Mapbox framework crashes or renders blank.
- **Goal:**
  1. Guard Mapbox imports so app never crashes if native module is absent.
  2. Display clear fallback UI ("Map requires native build") or standard OpenStreetMap / Web fallback when running outside native prebuild.
