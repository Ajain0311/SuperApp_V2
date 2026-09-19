# SuperApp MVP — Full End-to-End UAT Test Plan

**Test Plan Version:** 2.0.0  
**Date:** September 19, 2026  
**Environment:** ASP.NET Core 10 Web API (Port 5000) ↔ Supabase PostgreSQL ↔ React Native + Expo (Metro / Web / Device)  

---

## 1. Test Objectives & Methodology

The goal of this UAT is to systematically validate the complete end-to-end user journeys across all five operational roles using real backend APIs and real-time SignalR hubs:

1. **Role 1 — CUSTOMER:** Authentication via OTP, Food Ordering & Cart Checkout, Ride Booking & Telemetry, Community Bazaar Ad Browsing & Inquiries, Submitting Reviews & Ratings.
2. **Role 2 — DRIVER:** Mode Switch, Online/Offline Duty Toggle, Receiving Dispatched Ride Requests, Trip Progression (`ACCEPTED` ➔ `ARRIVING` ➔ `STARTED` via OTP ➔ `COMPLETED`), Earnings Verification.
3. **Role 3 — RESTAURANT_OWNER (Vendor):** Mode Switch, Kitchen Order Flow (`PENDING` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `READY` ➔ `DELIVERED` / `CANCELLED`), Menu & Category Management.
4. **Role 4 — MARKETPLACE_SELLER:** Mode Switch, Posting Ad, Managing Store Ad Status (`ACTIVE` ➔ `SOLD`), Removing Ad.
5. **Role 5 — ADMIN:** Mode Switch, Platform KPI Analytics, User Management & Suspension, Content Moderation, App Settings Modification, Broadcasting System Push Announcements.

---

## 2. Test Cases Specification

### Suite 1: Authentication & Multi-Role Switching (AUTH)

| Test ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | OTP Request (PunjabGov SMS API / Dev Fallback) | Enter mobile `6375002348`, tap "Send OTP". | OTP generated; SMS dispatched or logged in dev fallback mode. |
| **AUTH-02** | OTP Verification & Token Storage | Enter valid OTP `123456`, tap "Verify". | JWT token returned with roles `[CUSTOMER, DRIVER, RESTAURANT_OWNER, MARKETPLACE_SELLER, ADMIN]`. Stored in SecureStore. |
| **AUTH-03** | Profile Role Discovery | Navigate to Account tab. | All 5 roles detected and displayed in role switcher modal. |
| **AUTH-04** | Role Mode Switching | Switch active role to `DRIVER`, then `RESTAURANT_OWNER`, then `MARKETPLACE_SELLER`, then `ADMIN`. | Tabs and theme color adapt dynamically without logging out or losing session. |

### Suite 2: Food Ordering & Kitchen Flow (FOOD)

| Test ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **FOOD-01** | Restaurant & Menu Fetch | In CUSTOMER mode, browse Food home and select restaurant. | Active restaurant profile, menu categories, and food items loaded from Supabase DB. |
| **FOOD-02** | Cart Calculation | Add 2 items, apply coupon `WELCOME50`. | Subtotal, discount, delivery fee, and grand total computed accurately. |
| **FOOD-03** | Order Placement | Select "Cash on Delivery", tap "Place Order". | `FoodOrder` row created with status `PENDING`. Redirected to `FoodOrderTrackingScreen`. |
| **FOOD-04** | Real-Time Kitchen Acceptance | In RESTAURANT_OWNER mode, open `KitchenOrders`. Tap "Accept Order". | Status moves to `ACCEPTED`. SignalR broadcasts `OrderStatusUpdated`. Tracking screen updates automatically. |
| **FOOD-05** | Kitchen Preparation & Delivery | Rest owner taps "Start Preparing" ➔ "Mark Food Ready" ➔ "Handed to Rider". | Order reaches `DELIVERED`. Passenger tracking screen transitions to step 4. |
| **FOOD-06** | Rating & Review Submission | Order delivered triggers `RatingModal`. Select 5 stars, type comment, submit. | Review saved in database; restaurant average rating and count updated. |
| **FOOD-07** | Kitchen Order Rejection | Place a test order, rest owner taps "Reject". | Order cancelled with confirmation; status set to `CANCELLED`. |

### Suite 3: Ride Booking & Driver Dispatch Flow (RIDE)

| Test ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **RIDE-01** | Fare Estimation | Enter pickup (Connaught Place) and dropoff (IGI Terminal 3). Select Bike. | Haversine distance (~16.4 km) and fare (~₹180) calculated. |
| **RIDE-02** | Ride Booking & Driver Pool Broadcast | Tap "Confirm Booking". | Ride created in status `REQUESTED` with 4-digit OTP. SignalR event `RideRequested` broadcast to `drivers-pool`. |
| **RIDE-03** | Driver Acceptance | In DRIVER mode, toggle Duty to ONLINE. Tap "Accept Trip" on available ride. | Ride assigned to driver; status becomes `ACCEPTED`. SignalR broadcasts `DriverAssigned` to rider. |
| **RIDE-04** | Driver Telemetry & Arriving | Driver marks "ARRIVING". GPS coordinates broadcast over SignalR. | Passenger map and status pill update to ARRIVING. |
| **RIDE-05** | Passenger OTP Verification | Driver enters rider's 4-digit OTP, taps "Start Trip". | Backend verifies OTP match; status transitions to `STARTED`. |
| **RIDE-06** | Trip Completion & Fare Recording | Driver taps "End Trip". | Status set to `COMPLETED`; actual fare charged; driver earnings incremented. |
| **RIDE-07** | Driver Rating Submission | Passenger sees `RatingModal`. Rate 5 stars. | Review saved; driver rating updated. |

### Suite 4: Bazaar Store & Marketplace Moderation (BAZAAR)

| Test ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **BAZ-01** | Post Marketplace Ad | In MARKETPLACE_SELLER mode, tap "Post Ad". Enter title, category, price, images. | Listing published in status `ACTIVE`. Appears in `MyStore` and public marketplace. |
| **BAZ-02** | Ad Browsing & Inquiries | In CUSTOMER mode, search for listing. Open detail screen. | Real listing details, images, seller info, and price loaded from API. |
| **BAZ-03** | Ad Moderation Reporting | In detail screen, tap Flag icon. Select "SPAM", submit report. | Backend records report; listing status updated to `FLAGGED` if severe. |
| **BAZ-04** | Mark Listing as Sold | In MARKETPLACE_SELLER mode, tap "Mark Sold" on ad. | Listing status updated to `SOLD` via API and displayed on card pill. |
| **BAZ-05** | Remove Listing | Seller taps "Remove Ad". | Listing deactivated and removed from active public search. |

### Suite 5: Admin Command Center (ADMIN)

| Test ID | Test Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **ADM-01** | Platform KPI Metrics | In ADMIN mode, view Overview tab. | Real counts of users, drivers, restaurants, orders, rides, gross volume, net platform commissions displayed. |
| **ADM-02** | User Management & Suspension | Search for user in Users tab. Tap "Suspend". | Account status toggled to suspended; can be reactivated. |
| **ADM-03** | Food Orders & Rides Monitoring | Open Orders and Rides tabs. | All platform transactions visible with customer phone and driver assignment details. |
| **ADM-04** | Ad Moderation Actions | In Bazaar tab, feature an ad or remove an ad. | Listing featured or removed via `POST /api/admin/marketplace/listings`. |
| **ADM-05** | Platform Settings Configuration | In Config tab, tap a setting (e.g. `platform_commission_percent`). Update value. | Setting value updated and persisted in `AppSettings` database table. |
| **ADM-06** | Push Announcement Broadcast | Enter title, message, select target role `DRIVER`. Tap "Send Push Broadcast". | Notifications inserted in database for all target users. |

---

## 3. Exit Criteria for UAT Phase

1. Zero crashes or unhandled promise rejections on mobile/web.
2. All five roles successfully switch modes and execute their designated operations.
3. SignalR hubs maintain continuous real-time synchronization between Customer, Driver, and Restaurant.
4. Database integrity verified on Supabase PostgreSQL for all transactions.
