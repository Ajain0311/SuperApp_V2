# SuperApp V2 — Developer Onboarding & Local Setup Guide

Welcome to the development environment setup for **SuperApp V2** (`HTTP-EXPNAT-NET`). This guide walks you through setting up, configuring, running, and verifying the entire fullstack application on your local machine.

---

## 1. System Prerequisites

Ensure you have the following toolchains installed:

| Toolchain | Minimum Version | Verification Command | Description |
|---|---|---|---|
| **.NET SDK** | 10.0.100+ | `dotnet --version` | ASP.NET Core 10 backend runtime & SDK |
| **Node.js** | 20.x or 22.x LTS | `node -v` | JavaScript runtime for React Native / Expo |
| **npm** | 10.x+ | `npm -v` | Node package manager |
| **Git** | 2.40+ | `git --version` | Version control system |
| **PostgreSQL / Supabase** | 15.0+ | `psql --version` | Relational database (local or cloud instance) |
| **Web Browser** | Latest Chromium | N/A | For running Expo Web and Playwright tests |

---

## 2. Repository Structure

```text
HTTP-EXPNAT-NET/
├── backend/
│   ├── SuperApp.API/            # ASP.NET Core 10 Web API project
│   │   ├── Controllers/         # 12 REST API controllers
│   │   ├── Hubs/                # SignalR WebSocket hubs (order, ride, chat)
│   │   ├── Models/              # Entity Framework Core 10 database entities
│   │   ├── Services/            # SMS, Payment, and Notification services
│   │   └── Program.cs           # Dependency injection & middleware pipeline
│   └── SuperApp.API.Tests/      # xUnit unit and integration test suite (67 tests)
├── database/
│   ├── SuperApp_Supabase.sql    # Complete idempotent schema definition (28 tables)
│   └── migrations/              # Incremental database migrations
├── docs/                        # Canonical project documentation
├── e2e/                         # Playwright automated live browser test suite
├── scripts/                     # Seed scripts, UAT executor, and health checkers
├── src/                         # React Native + Expo SDK 57 frontend source
│   ├── components/              # Shared UI components and modals
│   ├── navigation/              # React Navigation v7 stacks and role-adaptive tabs
│   ├── screens/                 # Mobile screens for Food, Rides, Bazaar, Driver, Admin
│   ├── services/                # Axios API client, SignalR client, GPS location
│   ├── store/                   # Zustand lightweight state management slices
│   └── theme/                   # Brand styling tokens, typography, and colors
├── .env.example                 # Frontend environment template
├── App.tsx                      # Root React Native application component
└── package.json                 # Node dependencies & Expo project configuration
```

---

## 3. Environment Configuration

### 3.1 Frontend Environment (`.env`)
Create a `.env` file in the project root by copying the example:

```bash
cp .env.example .env
```

Ensure your `.env` contains the local development endpoints:
```ini
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SIGNALR_URL=http://localhost:5000
EXPO_PUBLIC_ENV=development
```

### 3.2 Backend Configuration (`appsettings.Development.json`)
The backend is configured in `backend/SuperApp.API/appsettings.Development.json`. Verify the database connection string and JWT parameters:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=aws-0-ap-south-1.pooler.supabase.com;Port=6543;Database=postgres;Username=postgres.your_user;Password=your_password;SSL Mode=Require;Trust Server Certificate=true"
  },
  "JwtSettings": {
    "SecretKey": "SuperAppSecretKeyForDevelopmentTestingOnlyMustBeLongerThan256Bits!",
    "Issuer": "SuperApp.API",
    "Audience": "SuperApp.Client",
    "ExpiryDays": 30
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

---

## 4. Database Setup & Seeding

If setting up a fresh database, execute the SQL schema and migration scripts in order:

1. **Apply Core Schema**:
   Run `database/SuperApp_Supabase.sql` in your PostgreSQL or Supabase SQL Editor.
2. **Apply Schema Enhancements**:
   Run `database/migrations/20260919_schema_audit_enhancements.sql`.
3. **Seed Food Catalog & Sample Data**:
   ```bash
   node scripts/seed-food-all.js
   node scripts/seed-items.js
   ```

### Pre-Seeded Test Personas
The database comes pre-configured with test users for rapid development:

| Persona | Phone Number | Auth Mechanism | Roles |
|---|---|---|---|
| **Multi-Role Citizen** | `6375002348` | OTP: `123456` | `CUSTOMER`, `DRIVER`, `RESTAURANT_OWNER`, `MARKETPLACE_SELLER` |
| **Super Administrator** | `9999999999` | Password: `AdminPassword123!` | `ADMIN`, `CUSTOMER` |

---

## 5. Running the Application

### 5.1 Step 1: Launch Backend API
In terminal 1, run the ASP.NET Core Web API:
```bash
dotnet run --project backend/SuperApp.API/SuperApp.API.csproj --launch-profile http
```
- API will start listening on: `http://localhost:5000`
- Swagger UI (in Dev): `http://localhost:5000/swagger`

### 5.2 Step 2: Launch Frontend (Expo Web)
In terminal 2, start Expo:
```bash
npx expo start --clear
```
- Press `w` to launch the app directly in your browser at `http://localhost:8081`.
- Alternatively, download **Expo Go** on your physical iOS/Android phone and scan the displayed QR code.

---

## 6. Running Local Verifications & Tests

Before submitting pull requests or committing code, run the full verification pipeline:

```bash
# 1. Backend xUnit Unit & Integration Tests (67 tests)
dotnet test backend/SuperApp.API.Tests/SuperApp.API.Tests.csproj --no-build

# 2. TypeScript Static Typecheck (0 errors expected)
npx tsc --noEmit

# 3. Frontend Jest Tests (73 tests)
npm test -- --watchAll=false

# 4. Expo Ecosystem & Dependency Health (18 checks)
npx expo-doctor

# 5. Automated Full UAT Test Suite (48 scenarios)
node scripts/execute_full_uat.js

# 6. Live Playwright Browser Tests (15 form flows)
node e2e/master_live_test.js
```

---

## 7. Troubleshooting & FAQs

- **Port 5000 already in use**:
  Check if a background dotnet process is still running: `Get-Process -Name SuperApp.API` and terminate if needed.
- **Expo Web cache issues**:
  Clear cache via `npx expo start --clear`.
- **SignalR connection drops**:
  Ensure `EXPO_PUBLIC_SIGNALR_URL` matches the backend host and CORS is properly configured in `Program.cs`.
