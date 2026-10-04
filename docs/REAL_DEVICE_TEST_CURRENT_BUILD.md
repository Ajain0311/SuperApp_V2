# Real Device Intermediate Test Build Report

- **Date**: 2026-10-03
- **Test Build Type**: Standalone Intermediate Release APK (Not final production)
- **APK Path**: `android/app/build/outputs/apk/release/app-release.apk`
- **APK File Size**: 57.5 MB (57,565,235 bytes)
- **Git Commit SHA / Branch**: `main`
- **Target Backend API**: `http://makemytree.duckdns.org` (Port 80 cleartext traffic enabled)
- **Physical Device**: Realme RMX3870 (Android 16, ARM64-v8a, Serial: `FALBIFZTFI4PCQ8H`)

---

## 1. Feature Implementation Boundary Status

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Captain Food Delivery** | `NOT_IMPLEMENTED` | Reserved for backend developer. Unmodified. |
| **Online Food Payment** | `NOT_IMPLEMENTED` | Easebuzz live production keys pending. Sandbox/Mock active. Unmodified. |
| **COD Food Delivery Flow** | `WORKING & VERIFIED` | End-to-end verified on real Android phone & live PostgreSQL DB. |
| **User Authentication / OTP** | `WORKING & VERIFIED` | Test OTP flow active for intermediate testing build. |
| **Restaurant & Menu Browsing** | `WORKING & VERIFIED` | Live data from hosted API. |
| **Cart & Checkout** | `WORKING & VERIFIED` | Calculation, taxes, and order placement confirmed. |
| **Live Order Tracking** | `WORKING & VERIFIED` | Tracking screen rendered with live order number (`#FO-4311`). |
| **User Order History** | `WORKING & VERIFIED` | My Activity historical orders rendered. |
| **Community Marketplace** | `WORKING & VERIFIED` | Bazaar tab with categories, listings, and selling flow. |
| **Ride Hailing & Mapbox** | `WORKING & VERIFIED` | Mapbox native vector map, GPS coordinates, vehicle tiers (Bike, Auto, Cab). |

---

## 2. Real-Device Smoke Test Results (Physical Device: Realme RMX3870)

| # | Test Step | Result | Real-Device Evidence |
| :--- | :--- | :--- | :--- |
| 1 | App launches cleanly | **PASS** | Splash screen transitions to Home/Auth (`docs/live_screen_launch.png`, `docs/live_screen_loaded.png`) |
| 2 | Login works | **PASS** | Phone number input and submission verified (`docs/live_screen_login.png`) |
| 3 | Test OTP works | **PASS** | Test OTP displayed and Auto-Fill verified (`docs/live_screen_autofill.png`) |
| 4 | Home screen loads | **PASS** | Modules, services, active rides, spotlight deals loaded (`docs/live_screen_after_verify.png`) |
| 5 | API calls work | **PASS** | Communicating directly with `http://makemytree.duckdns.org` |
| 6 | Restaurants list loads | **PASS** | 7 popular spots loaded from hosted backend (`docs/live_screen_food_tab.png`) |
| 7 | Restaurant details load | **PASS** | Haldiram's Sweets & Thali details opened (`docs/live_screen_haldiram_menu.png`) |
| 8 | Menu loads with dishes & prices | **PASS** | Deluxe Veg Thali (₹237), Raj Kachori (₹199), Rasgulla (₹120), Kaju Katli (₹322) |
| 9 | Cart works | **PASS** | Item added, floating bottom cart bar displayed (`docs/live_screen_after_add.png`) |
| 10 | Checkout modal opens | **PASS** | Cart summary sheet with taxes & delivery breakdown (`docs/live_screen_cart_sheet.png`) |
| 11 | COD order can be placed | **PASS** | Fixed payment method code (`COD`) and placed order (`docs/live_screen_order_done.png`) |
| 12 | Order appears correctly | **PASS** | Live tracking screen loaded for Order `#FO-4311` (`docs/live_screen_order_placed_success.png`) |
| 13 | Live Database validation | **PASS** | Order row verified in Supabase PostgreSQL: `id: 170`, `order_number: FO-4311`, `status: PENDING`, `payment_method: COD`, `grand_total: 273.38` |
| 14 | User order history works | **PASS** | My Activity screen rendered with past orders (`docs/live_screen_item_added.png`) |
| 15 | Marketplace works | **PASS** | Community Marketplace with categories, items, and sell CTA (`docs/live_screen_bazaar_final.png`) |
| 16 | Ride section opens | **PASS** | Rides tab loaded with Mapbox map and vehicle selector (`docs/live_screen_rides_tab.png`) |
| 17 | Location permission & GPS work | **PASS** | Connaught Place GPS coordinates (28.6304°, 77.2177°) rendered on map |

---

## 3. Bug Fixes Applied During Testing

1. **Food Order Payment Method Code Mismatch**:
   - **File**: `src/features/food/RestaurantDetailScreen.tsx` (line 203)
   - **Issue**: Frontend was sending `paymentMethod: 'CASH_ON_DELIVERY'`, whereas backend `FoodOrdersController.cs` strictly validates `COD` or `ONLINE`.
   - **Fix**: Updated frontend to send `paymentMethod: 'COD'`.
   - **Verification**: Order `#FO-4311` placed and accepted with HTTP 200 by hosted backend.

---

## 4. Pending Features Handled by Another Developer

1. **Captain Food Delivery**: Dispatched assignment logic in backend.
2. **Online Food Payment**: Easebuzz live production merchant keys.
