# React Native Screen Mapping Reference

This document maps every screen in the Flutter customer application (`D:\FREELANCER\HTTP-FLUTnNET\super_app`) to its corresponding React Native implementation in `D:\FREELANCER\HTTP-EXPNAT-NET`.

---

## 1. Route & Screen Mapping Table

| # | Route URI | Flutter Screen File | React Native Screen File | Key Elements & Features |
|---|---|---|---|---|
| 1 | `/splash` | `lib/features/splash/screens/splash_screen.dart` | `src/features/splash/SplashScreen.tsx` | Rocket logo scale animation, auth token check, redirect to `/home` or `/login` |
| 2 | `/login` | `lib/features/auth/screens/phone_entry_screen.dart` | `src/features/auth/PhoneEntryScreen.tsx` | +91 mobile input, Send OTP action, terms note, loading spinner |
| 3 | `/otp` | `lib/features/auth/screens/otp_verification_screen.dart` | `src/features/auth/OtpVerificationScreen.tsx` | 6-digit PIN input, 120s timer, dev OTP hint (`123456`), name input for new users, password for admin |
| 4 | `/home` | `lib/features/home/screens/home_screen.dart` | `src/features/home/HomeScreen.tsx` | Location header, live ride in-transit banner, food 50% discount banner, module shortcuts, spotlight deals |
| 5 | `/food` | `lib/features/food/screens/food_home_screen.dart` | `src/features/food/FoodHomeScreen.tsx` | Search bar, category pills (Biryani, North Indian, etc.), filter chips, restaurant cards with veg badge, delivery time, offer badge |
| 6 | `/food/restaurant/:id` | `lib/features/food/screens/restaurant_detail_screen.dart` | `src/features/food/RestaurantDetailScreen.tsx` | Restaurant banner, menu category accordion, dish cards with customized tag, customization modal, cart floating bar |
| 7 | `/food/order-tracking/:id` | `lib/features/food/screens/food_order_tracking_screen.dart` | `src/features/food/FoodOrderTrackingScreen.tsx` | Estimated delivery orange card, 5-step order status stepper, delivery partner card (Ramesh Kumar), return home button |
| 8 | `/rides` | `lib/features/ride/screens/ride_booking_screen.dart` | `src/features/ride/RideBookingScreen.tsx` | Pickup & destination inputs, route distance/duration badge, mock route visualizer, 3 vehicle tiers (Bike ₹45, Auto ₹65, Cab ₹125), book CTA |
| 9 | `/rides/active/:id` | `lib/features/ride/screens/active_ride_screen.dart` | `src/features/ride/ActiveRideScreen.tsx` | SOS Emergency button, 4-digit start ride OTP card (`4829`), driver card (Amit Singh 4.9★, Hero Splendor Plus DL 04 AB 9821), trip status stepper, cancel ride |
| 10 | `/bazaar` | `lib/features/marketplace/screens/marketplace_home_screen.dart` | `src/features/marketplace/MarketplaceHomeScreen.tsx` | Community marketplace header, search bar, category pills, filter chips, 2-column product grid with condition badge & favorite heart, Sell Item FAB |
| 11 | `/bazaar/detail/:id` | `lib/features/marketplace/screens/listing_detail_screen.dart` | `src/features/marketplace/ListingDetailScreen.tsx` | Multi-photo carousel with pagination dots, negotiable tag, specs chips, description, verified seller card, buyer safety advisory, Make Offer modal |
| 12 | `/bazaar/add` | `lib/features/marketplace/screens/add_listing_screen.dart` | `src/features/marketplace/AddListingScreen.tsx` | Photo thumbnail carousel with add/delete, title input, category selector, price input, condition chips, location input, publish action |
| 13 | `/profile` | `lib/features/profile/screens/profile_screen.dart` | `src/features/profile/ProfileScreen.tsx` | User avatar with initials, verified badge, activity shortcuts (Food, Rides, Marketplace), settings options, logout confirmation |
| 14 | `/notifications` | `lib/features/notifications/screens/notifications_screen.dart` | `src/features/notifications/NotificationsScreen.tsx` | Grouped in-app alert cards with read/unread indicators, colored icons, and relative timestamps |
| 15 | `/activity?tab=:index` | `lib/features/activity/screens/activity_screen.dart` | `src/features/activity/ActivityScreen.tsx` | 3 tabs (Food Orders, Rides, Marketplace) displaying status badges, transaction totals, and order details |

---

## 2. Modal Sheets & Sub-Components

| Component Name | Flutter Implementation | React Native Implementation | Parent Screens |
|---|---|---|---|
| `ItemCustomizationSheet` | BottomSheet modal | `ItemCustomizationSheet.tsx` (Modal) | `RestaurantDetailScreen` |
| `CartSummarySheet` | BottomSheet modal | `CartSummarySheet.tsx` (Modal) | `RestaurantDetailScreen` |
| `MakeOfferModal` | BottomSheet modal | `ListingDetailScreen.tsx` (Modal) | `ListingDetailScreen` |
| `ContactSellerModal` | BottomSheet modal | `ListingDetailScreen.tsx` (Modal) | `ListingDetailScreen` |
| `AddPhotoModal` | SimpleDialog | `AddListingScreen.tsx` (Modal) | `AddListingScreen` |
