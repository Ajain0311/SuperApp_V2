# SuperApp V2 — Customer Mobile Application
*A single unified app for small businesses — Food Delivery, Ride Hailing & Community Marketplace.*

[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020.svg?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/Backend-ASP.NET%20Core%208.0-512BD4.svg?style=flat&logo=dotnet)](https://dotnet.microsoft.com/)
[![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg?style=flat&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-50%20Passing-brightgreen.svg?style=flat&logo=jest)](https://jestjs.io/)

A cross-platform customer mobile application built with **React Native** and **Expo SDK 57**, integrating Food Delivery, Ride Hailing, and Community Marketplace into a unified application.

Backed by an **ASP.NET Core 8.0** API with real-time **SignalR** WebSocket hubs, **Supabase PostgreSQL** database architecture, and native device push notifications and geolocation.

---

## 📱 Features & Modules

### 🍔 Food Delivery
- **Restaurant Discovery**: Browsing by cuisine, rating, veg/non-veg tags, and delivery time.
- **Dynamic Menu & Customizations**: Menu categories, dishes, portion sizes (variants), and addons.
- **Cart & Checkout**: Multi-restaurant protection, real-time GST tax calculation, and free delivery thresholds.
- **Live Order Tracking**: Real-time 5-stage order status updates via SignalR WebSocket (`OrderStatusHub`).

### 🚖 Ride Hailing
- **Real GPS Location**: Customer pickup coordinate acquisition via `expo-location` with street reverse-geocoding.
- **Fare Estimation**: Urban Haversine distance calculations and multi-tier vehicle selection (Bike Taxi, Auto Rickshaw, Economy Cab).
- **Driver Matching & Start OTP**: Instant driver assignment with 4-digit ride verification OTP.
- **Real-Time Telemetry**: Live driver location updates streamed via SignalR (`RideTrackingHub`).

### 🛍️ Community Bazaar (Marketplace)
- **Classifieds Feed**: Browse listings across 8 categories (Mobiles, Vehicles, Electronics, Furniture, Fashion, etc.).
- **Listing Details**: Multi-photo galleries, condition badges (`NEW`, `LIKE_NEW`, `USED`, `FAIR`), and seller profiles.
- **Ad Publishing**: Multi-photo ad publisher with condition selector and local store synchronization.
- **Favorites & Search**: Instant bookmarking and client/server search filtering.

### 🔔 Notifications & Deep Linking
- **Expo Push Notifications**: Native permission management, EAS push token retrieval, and background local alerts.
- **Deep-Link Response Routing**: Tapping notifications navigates to targeted screens (`FoodOrderTracking`, `ActiveRide`, `ListingDetail`, or `Notifications`).
- **In-App Dev Tester**: Dedicated panel (`__DEV__`) for immediate test alert dispatch.

---

## 🏗️ Architecture & Tech Stack

- **Framework**: React Native 0.86.3 / Expo SDK 57
- **Language**: TypeScript 6.0 (Strict mode, zero `any` leaks)
- **State Management**: Zustand 5.0 (Lightweight, unopinionated client stores)
- **Navigation**: React Navigation v7 (Native Stack + Bottom Tabs)
- **HTTP Client**: Axios with JWT Bearer interceptors and error normalization
- **Real-Time Client**: `@microsoft/signalr` 10.0 with automatic exponential reconnection
- **Device Native APIs**:
  - `expo-location` (Foreground GPS, reverse geocoding, continuous watching)
  - `expo-notifications` (Remote push tokens, local scheduling, notification listeners)
  - `expo-secure-store` (Encrypted auth token storage)
  - `expo-font` & `@expo/vector-icons` (Icon packs and typography)
- **Backend API**: ASP.NET Core 8.0 (`SuperApp.API`) on `http://localhost:5000`
- **Database**: Supabase PostgreSQL 15+ (28 relational tables, idempotent schema in `database/SuperApp_Supabase.sql`)

---

## 📂 Project Structure

```
├── assets/                  # App icons, splash screens, and adaptive assets
├── database/                # Supabase PostgreSQL relational database schema
│   └── SuperApp_Supabase.sql
├── docs/                    # Architecture, API mapping, and technical specs
│   ├── CHANGELOG.md
│   ├── DATABASE_CONTRACT.md
│   ├── LOCATION.md
│   ├── NOTIFICATIONS.md
│   ├── REACT_NATIVE_API_MAPPING.md
│   ├── REACT_NATIVE_ARCHITECTURE.md
│   ├── REACT_NATIVE_CONFIGURATION.md
│   ├── REACT_NATIVE_STATUS.md
│   ├── REAL_IMPLEMENTATION_AUDIT.md
│   └── SUPABASE_DATABASE.md
├── src/
│   ├── config/              # Environment resolution and endpoint configuration
│   ├── constants/           # API routes, hub endpoints, and static tokens
│   ├── features/            # Domain screens & components
│   │   ├── activity/        # History tabs (Food, Rides, Marketplace)
│   │   ├── auth/            # Phone entry & 6-digit OTP verification
│   │   ├── food/            # Restaurants, menus, cart, and live tracking
│   │   ├── home/            # Dashboard, quick modules, and promos
│   │   ├── marketplace/     # Bazaar listings, detail, and ad publisher
│   │   ├── notifications/   # Alerts feed and dev push tester
│   │   ├── profile/         # User account and data source badge
│   │   ├── ride/            # Pickup GPS booking and driver tracking
│   │   └── splash/          # Animated branded splash screen
│   ├── navigation/          # RootNavigator, MainTabNavigator, navigationRef
│   ├── services/            # apiClient, signalr, locationService, notificationService
│   ├── store/               # authStore, cartStore, marketplaceStore
│   └── theme/               # Colors, typography, and 8pt spacing tokens
├── __tests__/               # Jest test suites (Services, Stores, Flows)
├── App.tsx                  # Root entry point with lifecycle listeners
├── app.json                 # Expo project configuration and native permissions
└── package.json             # Dependencies and scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or v22+
- **npm**: v10 or v11+
- **Expo Go App**: Installed on physical iOS or Android device (or an active emulator)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Ajain0311/SuperApp_V2.git
cd SuperApp_V2
npm install
```

### 3. Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env
```
Edit `.env` to configure your backend URL:
```env
# Workstation Localhost
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000

# Android Emulator
# EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000

# Physical Device on Local Wi-Fi
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:5000
```

### 4. Running the Application
Start the Expo development server:
```bash
npx expo start
```
- Press `a` for Android Emulator
- Press `i` for iOS Simulator (macOS)
- Press `w` for Web Browser
- Scan the terminal QR code with the **Expo Go** mobile app

---

## 🧪 Testing & Verification

Run the full automated test suite (50 unit & E2E integration tests across 9 test suites):
```bash
npm test
```

Verify TypeScript compilation (0 errors):
```bash
npx tsc --noEmit
```

Run Expo project diagnostics (18/18 checks passed):
```bash
npx expo-doctor
```

---

## 🗄️ Database Setup (Supabase PostgreSQL)

1. Open your [Supabase Dashboard](https://app.supabase.com).
2. Navigate to the **SQL Editor**.
3. Copy and run [`database/SuperApp_Supabase.sql`](database/SuperApp_Supabase.sql).
4. The script creates all 28 tables, constraints, foreign keys, indexes, and bootstrap master seed data idempotently.

For complete database details and mapping specifications, see [`docs/DATABASE_CONTRACT.md`](docs/DATABASE_CONTRACT.md) and [`docs/SUPABASE_DATABASE.md`](docs/SUPABASE_DATABASE.md).

---

## 🔒 Security & Privacy

- No real API keys, credentials, or private `.env` files are committed.
- `.gitignore` rigorously excludes environment secrets, native build directories, and dependency bundles.
- Passwords are encrypted using BCrypt by the backend API; plaintext passwords are never stored or transmitted.

---

## 📄 License

This project is proprietary and confidential. Licensed under the [MIT License](LICENSE).
>>>>>>> 47c54b4 (docs: add comprehensive project README for SuperApp_V2)
