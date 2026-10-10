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
| **FIX-04** | Image Compression & Thumbnail Pipeline (High Quality, Low Memory) | P1 (High) | `[ ] OPEN` |
| **FIX-05** | Ride Cancellation & Food Order State Integrity (Prevent Ghost Deletion) | P1 (High) | `[ ] OPEN` |
| **FIX-06** | Admin Dashboard Mobile & Tablet Responsive UI Overhaul | P2 (Medium) | `[ ] OPEN` |
| **FIX-07** | Automated Push Notifications (2-3 times daily engagement broadcast) | P2 (Medium) | `[ ] OPEN` |
| **FIX-08** | Production Hardening: Disable Mock OTP & Test Payment Gateways | P0 (Critical) | `[ ] OPEN` |

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

### FIX-06: Admin Dashboard Mobile & Tablet Responsive UI Overhaul
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

## 🤖 Interaction Guideline for Agents & Developers

When anyone joins this project:
1. **Developer Greeting / Incoming Prompts:**
   - First ask: *"Hi! We have a curated list of existing production bug fixes in `PENDING_FIXES.md`. Would you like to fix the top-priority issues first, or should I queue your new task into the backlog?"*
2. **Priority Rule:**
   - If user/developer says "Fix top priority first" -> Pick the next `[ ] OPEN` task from `PENDING_FIXES.md`.
   - If user gives a direct command/preference -> **User request is always top priority**, execute immediately, and log any follow-ups in `PENDING_FIXES.md` and `ROADMAP.md`.
3. **Completion Rule:**
   - As soon as a task is fixed and all tests (`dotnet test`, `npx tsc --noEmit`, `npm test`) pass, change `[ ] OPEN` to `[x] CLOSED`, update `ROADMAP.md`, and clean the backlog.
