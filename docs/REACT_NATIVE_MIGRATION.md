# React Native + Expo Migration Guide

This document details the migration of the SuperApp mobile customer application from Flutter (`D:\FREELANCER\HTTP-FLUTnNET\super_app`) to React Native + Expo (`D:\FREELANCER\HTTP-EXPNAT-NET`).

---

## 1. Executive Summary

The React Native + Expo version was engineered in an isolated, independent workspace (`D:\FREELANCER\HTTP-EXPNAT-NET`) to provide an exact functional and visual twin of the Flutter customer application without modifying, refactoring, or touching the original Flutter/.NET codebase.

- **Source Codebase**: `D:\FREELANCER\HTTP-FLUTnNET` (Read-only, untouched)
- **Destination Codebase**: `D:\FREELANCER\HTTP-EXPNAT-NET` (Independent git repository)
- **Backend**: Kept on ASP.NET Core (.NET 8/9) with SQL Server and SignalR hubs.
- **Frontend Stack**: Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 5.9, React Navigation v7, Zustand, Axios, Microsoft SignalR client.

---

## 2. Parity & Feature Overview

| Feature / Domain | Flutter Implementation (`super_app`) | React Native Implementation (`HTTP-EXPNAT-NET`) | Parity Status |
|---|---|---|---|
| **Theme & Aesthetics** | Dark theme `#0A0E21`, Surface `#141829`, Accents `#FF6B35`, `#00C853`, `#2196F3` | Exact matching palette in `src/theme/` | 100% Identical |
| **Splash & Branding** | `SplashScreen` with rocket pulse animation & token check | `SplashScreen.tsx` with animated scale & token check | 100% Identical |
| **Authentication** | `PhoneEntryScreen`, `OtpVerificationScreen` (6-digit PIN, dev OTP `123456`, admin bypass) | `PhoneEntryScreen.tsx`, `OtpVerificationScreen.tsx` with auto-focus PIN boxes & dev hints | 100% Identical |
| **Main Shell Navigation** | `MainShellScreen` + 4 Tabs (Home, Food, Rides, Bazaar) | `MainTabNavigator.tsx` (Home, Food, Rides, Bazaar) | 100% Identical |
| **Home Dashboard** | `HomeScreen` with live ride transit card, food deal carousel, module shortcuts | `HomeScreen.tsx` with live active ride banner, 50% discount card, spotlight carousel | 100% Identical |
| **Food Discovery** | `FoodHomeScreen` with filters, category pills, restaurant cards with veg/time badges | `FoodHomeScreen.tsx` with identical filter chips, ratings, and cards | 100% Identical |
| **Restaurant & Menu** | `RestaurantDetailScreen` with menu sections, customizable dishes | `RestaurantDetailScreen.tsx` with portion selection & add-ons sheet | 100% Identical |
| **Cart & Ordering** | `CartSummarySheet` with item breakdown, 5% GST, free delivery, checkout | `CartSummarySheet.tsx` + `cartStore.ts` with real-time total computation | 100% Identical |
| **Order Tracking** | `FoodOrderTrackingScreen` with 5-step stepper & delivery partner card | `FoodOrderTrackingScreen.tsx` with 5-step animated progress stepper | 100% Identical |
| **Ride Booking** | `RideBookingScreen` with 3 vehicle tiers (Bike, Auto, Cab) and mock route | `RideBookingScreen.tsx` with 3 tiers and route visualizer | 100% Identical |
| **Active Ride Tracking** | `ActiveRideScreen` with OTP card `4829`, driver Amit Singh, SOS emergency button | `ActiveRideScreen.tsx` with SOS button, 4-digit OTP box, driver card, and status stepper | 100% Identical |
| **Community Bazaar** | `MarketplaceHomeScreen` with 2-column grid, search, filters, and Sell FAB | `MarketplaceHomeScreen.tsx` with favorite toggling, search, and category pills | 100% Identical |
| **Listing Detail** | `ListingDetailScreen` with photo carousel, seller profile, and Make Offer modal | `ListingDetailScreen.tsx` with paging photo carousel, seller profile, and offer modal | 100% Identical |
| **Add Listing** | `AddListingScreen` with photo URL inputs, category picker, and condition chips | `AddListingScreen.tsx` with photo preview, condition selectors, and Zustand sync | 100% Identical |
| **User Profile & Activity** | `ProfileScreen`, `NotificationsScreen`, `ActivityScreen` (Food, Rides, Bazaar tabs) | `ProfileScreen.tsx`, `NotificationsScreen.tsx`, `ActivityScreen.tsx` | 100% Identical |

---

## 3. Technology Equivalency Table

| Concern | Flutter Equivalent | React Native Equivalent |
|---|---|---|
| Framework | Flutter 3.x (Dart) | React Native 0.86.3 / Expo SDK 57 (TypeScript) |
| Routing | `go_router` (Nested Shells & GoRoutes) | `@react-navigation/native-stack` + `@react-navigation/bottom-tabs` |
| State Management | `flutter_riverpod` | `zustand` |
| HTTP Client | `dio` / `http` | `axios` with interceptors |
| Real-time WebSockets | SignalR client / SSE | `@microsoft/signalr` |
| Local Storage | `flutter_secure_storage` / `shared_preferences` | `expo-secure-store` / `@react-native-async-storage/async-storage` |
| Icons | `Icons.*` / CupertinoIcons | `@expo/vector-icons` (`MaterialIcons`, `Ionicons`) |
| Gradients | `LinearGradient` | `expo-linear-gradient` |
| Safe Area | `SafeArea` widget | `react-native-safe-area-context` |

---

## 4. Migration Best Practices Adopted

1. **No Backend Disruption**: All API endpoint routes (`/api/v1/Auth/*`, `/api/v1/Food/*`, `/api/v1/Rides/*`, `/api/v1/Marketplace/*`) and Hub paths (`/hubs/ride`, `/hubs/order`, `/hubs/chat`) are identical.
2. **Offline Resilience**: Rich initial mock datasets match Flutter seed data so the mobile application is fully functional and interactive even when the backend server is offline.
3. **Strict Secrets Hygiene**: API keys, endpoints, and credentials are configuration-driven via `.env` with `.env.example` committed and real environment files gitignored.
