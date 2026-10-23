# SuperApp V2 — Multi-Service Platform & Mobile Ecosystem
*Unified platform for Food Delivery, Ride Hailing, and Community Marketplace.*

[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020.svg?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/Backend-ASP.NET%20Core%2010.0-512BD4.svg?style=flat&logo=dotnet)](https://dotnet.microsoft.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2015%2B-3ECF8E.svg?style=flat&logo=postgresql)](https://supabase.com/)

A modern, production-ready cross-platform application built with **React Native** and **Expo SDK 57**, powered by an **ASP.NET Core 10** Web API with real-time **SignalR** WebSocket hubs, a pooled **PostgreSQL** relational database, and native Android/iOS push notifications.

---

## 📚 Canonical Documentation

- [**Rapid Development Guide**](docs/RAPID_DEVELOPMENT_GUIDE.md) — *Recommended starting guide for AI agents and developers.*
- [**System Architecture & Data Flow**](docs/ARCHITECTURE.md)
- [**Configuration & Secrets Manual**](docs/CONFIGURATION_AND_SECRETS.md)
- [**Database Specification & ER Model**](docs/DATABASE.md)
- [**REST API & SignalR Reference**](docs/API.md)
- [**Roles & Permissions Guide**](docs/ROLES_AND_PERMISSIONS.md)
- [**Developer Onboarding & Local Setup**](docs/DEVELOPMENT_SETUP.md)
- [**Production Release Checklist**](docs/RELEASE_CHECKLIST.md)

---

## 📱 Core Features & Modules

### 🍔 Food Delivery
- **Restaurant Discovery**: Browsing by cuisine, rating, veg/non-veg tags, and delivery time.
- **Dynamic Menu & Customizations**: Menu categories, dishes, portion sizes (variants), and addons.
- **Cart & Checkout**: Multi-restaurant protection, real-time GST tax calculation, and coupon codes (`WELCOME50`).
- **Kitchen Dispatch & Live Tracking**: Real-time order status updates via SignalR WebSocket (`OrderStatusHub`).

### 🚖 Ride Hailing
- **Real GPS Location**: Customer pickup coordinate acquisition via `expo-location` with street reverse-geocoding.
- **Haversine & Mapbox Fare Estimation**: Accurate urban distance calculations and multi-tier vehicle selection (Bike Taxi, Auto Rickshaw, Economy Cab).
- **Captain Ride Broadcasting**: Instant push notification dispatch to all registered captains on incoming rides.
- **Driver Matching & Start OTP**: Instant driver dispatch with 4-digit ride verification OTP.
- **Real-Time Telemetry**: Live driver location updates streamed via SignalR (`RideTrackingHub`).

### 🛍️ Community Bazaar (Marketplace)
- **Classifieds Feed**: Browse listings across categories (Mobiles, Vehicles, Electronics, Furniture, Fashion, etc.).
- **Live Marketplace Chat**: Real-time buyer-seller messaging with SignalR and push notification delivery on new messages.
- **Listing Details & Offers**: Multi-photo galleries, condition badges, seller profiles, and buyer offer negotiation.
- **Ad Publishing & Moderation**: Multi-photo ad publisher with condition selector and spam reporting.

### 🔄 Single-Identity Multi-Role System
- Single user identity switching dynamically between **Customer**, **Driver (Captain)**, **Restaurant Vendor**, **Marketplace Seller**, and **Admin**.
- Responsive UI adapts bottom navigation tabs and reachable routes instantaneously via `useRoleStore`.

---

## 🏗️ Architecture & Tech Stack

- **Framework**: React Native 0.86.3 / Expo SDK ~57.0.24
- **Language**: TypeScript ~6.0.3 (Strict mode, zero compilation warnings)
- **State Management**: Zustand 5.0.15
- **Navigation**: React Navigation v7 (Native Stack + Dynamic Bottom Tabs)
- **HTTP & Real-Time**: Axios + `@microsoft/signalr` 10.0 (with exponential reconnection)
- **Push Notifications**: Real Android & iOS push via Expo Push Service (`exp.host/--/api/v2/push/send`) or FCM with dedicated Android notification channels (`ride-requests`, `default`).
- **Backend API**: ASP.NET Core 10.0 (`SuperApp.API`) hosted with reverse-proxy over TLS
- **Database**: PostgreSQL 15+ (28 relational tables, schema in `database/SuperApp_Supabase.sql`, migrations in `database/migrations/`)
- **External Gateways**: BIGB SMS Gateway, Easebuzz Payment Gateway

---

## 📂 Repository Structure

```text
HTTP-EXPNAT-NET/
├── App.tsx                     # Main application entry point & root providers
├── app.json                    # Expo configuration & plugins
├── package.json                # React Native & Expo dependencies
├── .env.example                # Unified configuration template
│
├── src/                        # React Native Mobile App Frontend
│   ├── components/             # Reusable UI components & layouts
│   ├── config/                 # Environment configuration (API, Mapbox, SignalR)
│   ├── constants/              # API endpoints, storage keys, colors
│   ├── features/               # Domain feature modules
│   │   ├── auth/               # OTP login, registration, role switcher
│   │   ├── food/               # Restaurants, menus, cart, order tracking
│   │   ├── rides/              # Map, fare estimate, booking, active ride
│   │   ├── driver/             # Captain dashboard, ride acceptance, status
│   │   ├── marketplace/        # Feed, listing details, ad post, live chat
│   │   ├── notifications/      # Notification list, read/unread status
│   │   └── admin/              # Admin portals, analytics, management
│   ├── navigation/             # RootNavigator, role-based TabNavigator
│   ├── services/               # API client, SignalR, Push notifications, Mapbox
│   ├── store/                  # Zustand state stores (auth, cart, role, etc.)
│   └── theme/                  # Design tokens (colors, typography, spacing)
│
├── backend/                    # ASP.NET Core 10.0 Web API
│   ├── SuperApp.sln            # Visual Studio / .NET Solution
│   └── SuperApp.API/           # Web API Project
│       ├── Controllers/        # REST API endpoints (Auth, Food, Rides, Notifications...)
│       ├── Data/               # AppDbContext (PostgreSQL / EF Core)
│       ├── DTOs/               # Data Transfer Objects
│       ├── Hubs/               # SignalR WebSockets (ChatHub, OrderHub, RideHub)
│       ├── Models/             # Entity Models (28 relational tables)
│       ├── Services/           # Push notification dispatcher, SMS, Payments
│       └── appsettings.json    # Backend configuration
│
├── database/                   # PostgreSQL DDL schemas & migrations
└── docs/                       # Canonical project documentation
```

---

## ⚡ Quick Start & Verification

### 1. Backend Verification
```bash
# Build the ASP.NET Core 10 backend solution
dotnet build backend/SuperApp.sln

# Run backend locally
dotnet run --project backend/SuperApp.API/SuperApp.API.csproj
```

### 2. Frontend Verification
```bash
# Verify TypeScript strict type-checking
npx tsc --noEmit

# Start Expo development server
npx expo start
```
