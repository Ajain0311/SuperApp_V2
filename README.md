# SuperApp V2 — Customer Mobile Application
*A single unified app for small businesses — Food Delivery, Ride Hailing & Community Marketplace.*

[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020.svg?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/Backend-ASP.NET%20Core%2010.0-512BD4.svg?style=flat&logo=dotnet)](https://dotnet.microsoft.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2015%2B-3ECF8E.svg?style=flat&logo=postgresql)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Unit%20Tests-140%20Passing-brightgreen.svg?style=flat&logo=jest)](https://jestjs.io/)
[![UAT](https://img.shields.io/badge/UAT%20Scenarios-48%2F48%20Passing-brightgreen.svg?style=flat)](docs/UAT_RESULTS.md)
[![Live E2E](https://img.shields.io/badge/Playwright%20E2E-15%2F15%20Passing-brightgreen.svg?style=flat)](docs/UAT_RESULTS.md)

A cross-platform mobile ecosystem built with **React Native** and **Expo SDK 57**, integrating Food Delivery, Ride Hailing, and Community Marketplace into a single application.

Powered by an **ASP.NET Core 10** Web API with real-time **SignalR** WebSocket hubs, a pooled **PostgreSQL** database (28 relational tables), zero-cost offline postal lookup engine, and native device push notifications and geolocation.

---

## 📚 Canonical Documentation

Complete architecture, database, API, and deployment documentation is organized under the [`docs/`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/) directory:

- [**Documentation Hub & Index**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/README.md)
- [**System Architecture & Zero-Cost Design**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/ARCHITECTURE.md)
- [**Database Specification & ER Model**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DATABASE.md)
- [**REST API & SignalR Reference**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/API.md)
- [**Roles & Permissions Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/ROLES_AND_PERMISSIONS.md)
- [**Developer Onboarding & Local Setup**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/DEVELOPMENT_SETUP.md)
- [**Production Setup & Deployment Manual**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/PRODUCTION_SETUP.md)
- [**Automated Testing & QA Guide**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/TESTING.md)
- [**UAT & Live Browser Test Results**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/UAT_RESULTS.md)
- [**Production Release Checklist**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/RELEASE_CHECKLIST.md)
- [**Project Changelog**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/docs/CHANGELOG.md)
- [**Project Roadmap & Task Tracker**](file:///D:/FREELANCER/HTTP-EXPNAT-NET/ROADMAP.md)

---

## 📱 Core Features & Modules

### 🍔 Food Delivery
- **Restaurant Discovery**: Browsing by cuisine, rating, veg/non-veg tags, and delivery time.
- **Dynamic Menu & Customizations**: Menu categories, dishes, portion sizes (variants), and addons.
- **Cart & Checkout**: Multi-restaurant protection, real-time GST tax calculation, and coupon codes (`WELCOME50`).
- **Kitchen Dispatch & Live Tracking**: Real-time 5-stage order status updates via SignalR WebSocket (`OrderStatusHub`).

### 🚖 Ride Hailing
- **Real GPS Location**: Customer pickup coordinate acquisition via `expo-location` with street reverse-geocoding.
- **Haversine Fare Estimation**: Zero-cost urban distance calculations and multi-tier vehicle selection (Bike Taxi, Auto Rickshaw, Economy Cab).
- **Driver Matching & Start OTP**: Instant driver dispatch with 4-digit ride verification OTP.
- **Real-Time Telemetry**: Live driver location updates streamed via SignalR (`RideTrackingHub`).

### 🛍️ Community Bazaar (Marketplace)
- **Classifieds Feed**: Browse listings across 8 categories (Mobiles, Vehicles, Electronics, Furniture, Fashion, etc.).
- **Listing Details**: Multi-photo galleries, condition badges (`NEW`, `LIKE_NEW`, `USED`, `FAIR`), and seller profiles.
- **Ad Publishing & Moderation**: Multi-photo ad publisher with condition selector, plus citizen reporting modal for spam/inappropriate ads.
- **Favorites & Search**: Instant bookmarking and client/server search filtering.

### 🔄 Single-Identity Multi-Role System
- Single user identity switching dynamically between **Customer**, **Driver**, **Restaurant Vendor**, **Marketplace Seller**, and **Admin**.
- Responsive UI adapts bottom navigation tabs and reachable routes instantaneously via `useRoleStore`.

---

## 🏗️ Architecture & Tech Stack

- **Framework**: React Native 0.86.3 / Expo SDK ~57.0.24
- **Language**: TypeScript ~6.0.3 (Strict mode)
- **State Management**: Zustand 5.0.15
- **Navigation**: React Navigation v7 (Native Stack + Dynamic Bottom Tabs)
- **HTTP & Real-Time**: Axios + `@microsoft/signalr` 10.0 (with exponential reconnection)
- **Backend API**: ASP.NET Core 10.0 (`SuperApp.API`) on `http://localhost:5000`
- **Database**: PostgreSQL 15+ (28 relational tables, schema in `database/SuperApp_Supabase.sql`, migrations in `database/migrations/`)
- **External Gateways**: Punjab State e-Governance DLT SMS Gateway, Easebuzz Payment Gateway

---

## 📂 Repository Structure

```text
HTTP-EXPNAT-NET/
├── backend/
│   ├── SuperApp.API/            # ASP.NET Core 10 Web API
│   └── SuperApp.API.Tests/      # xUnit unit & integration test suite (67 tests)
├── database/
│   ├── SuperApp_Supabase.sql    # Idempotent 28-table PostgreSQL schema
│   └── migrations/              # Incremental database migrations
├── docs/                        # 11 Canonical documentation files
├── e2e/
│   └── master_live_test.js      # Canonical Playwright Chromium live browser test
├── scripts/
│   ├── execute_full_uat.js      # Canonical 48-scenario automated UAT runner
│   ├── seed-food-all.js         # Food catalog seed script
│   └── seed-items.js            # Marketplace item seed script
├── src/                         # React Native application source
├── __tests__/                   # Frontend Jest test suites (73 tests)
├── App.tsx                      # Root component
└── package.json                 # Dependencies & scripts
```

---

## 🚀 Quick Start

### 1. Launch Backend (.NET 10)
```bash
dotnet run --project backend/SuperApp.API/SuperApp.API.csproj --launch-profile http
```
- Listens on `http://localhost:5000`

### 2. Launch Frontend (Expo Web / Mobile)
```bash
npx expo start --clear
```
- Press `w` to open in browser (`http://localhost:8081`) or scan QR with **Expo Go**.

---

## 🧪 Verification & Testing Pipeline

```bash
# 1. Backend Unit Tests (67 tests)
dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj --no-build

# 2. Frontend Unit Tests (73 tests)
npm test -- --watchAll=false

# 3. TypeScript Compilation (0 errors)
npx tsc --noEmit

# 4. Expo Diagnostics (18/18 checks)
npx expo-doctor

# 5. Automated Full UAT (48 scenarios)
node scripts/execute_full_uat.js

# 6. Live Playwright Browser Tests (15 flows)
node e2e/master_live_test.js
```

---

## 📄 License

This project is proprietary and confidential. Licensed under the [MIT License](LICENSE).
