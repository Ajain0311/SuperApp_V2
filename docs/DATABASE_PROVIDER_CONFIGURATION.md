# SuperApp — Database Multi-Provider Configuration Guide

## 1. Overview & Architecture

The **SuperApp** ASP.NET Core backend (`backend/SuperApp.API`) located directly within the active **HTTP-EXPNAT-NET** workspace supports seamless runtime provider switching across three primary database backends without requiring code rebuilds or migrations:

```
┌────────────────────────────────────────────────────────┐
│               ASP.NET Core SuperApp.API                │
│              (AppDbContext - 28 DbSets)                │
└──────────────────────────┬─────────────────────────────┘
                           │ DATABASE_PROVIDER
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐     ┌───────────┐     ┌───────────┐
   │ InMemory  │     │ SqlServer │     │ Postgres  │
   │ Provider  │     │ Provider  │     │(Supabase) │
   └───────────┘     └───────────┘     └───────────┘
```

1. **InMemory**: Zero-dependency, ephemeral database for local offline development, unit tests, and CI/CD pipelines. Seeded on startup with default roles, admin user, and marketplace categories.
2. **SqlServer**: Traditional Microsoft SQL Server / Azure SQL target using `Microsoft.EntityFrameworkCore.SqlServer`.
3. **Postgres / Supabase**: High-performance PostgreSQL 15+ target using `Npgsql.EntityFrameworkCore.PostgreSQL` and `EFCore.NamingConventions` (snake_case column and table mappings).

---

## 2. Configuration Matrix

Database selection is environment-driven with fallback to `appsettings.json`:

| Provider Option | `DATABASE_PROVIDER` Values | EF Core Driver | Connection String Source | Default / Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **In-Memory** | `InMemory` | `Microsoft.EntityFrameworkCore.InMemory` | N/A (`SuperAppInMemoryDb`) | Ephemeral memory storage |
| **PostgreSQL / Supabase** | `Postgres`, `PostgreSQL`, `Supabase`, `Npgsql` | `Npgsql.EntityFrameworkCore.PostgreSQL` (v10.0.3) | `DATABASE_CONNECTION_STRING` -> `ConnectionStrings:SupabaseConnection` -> `ConnectionStrings:PostgresConnection` -> `ConnectionStrings:DefaultConnection` | `Host=localhost;Database=SuperAppDB;Username=postgres;Password=postgres;` |
| **SQL Server** | `SqlServer`, `MsSql`, or unspecified | `Microsoft.EntityFrameworkCore.SqlServer` (v10.0.12) | `DATABASE_CONNECTION_STRING` -> `ConnectionStrings:SqlServerConnection` -> `ConnectionStrings:DefaultConnection` | `Server=localhost;Database=SuperAppDB;Trusted_Connection=true;TrustServerCertificate=true;` |

---

## 3. Connecting to Supabase PostgreSQL

### Connection String Formats

Supabase provides two connection types in **Project Settings -> Database**:

#### Option A: Connection Pooler (Recommended for Cloud / Serverless)
- **Host**: `aws-0-[REGION].pooler.supabase.com`
- **Port**: `5432` (Session Mode) or `6543` (Transaction Mode)
- **Database**: `postgres`
- **User**: `postgres.[YOUR-PROJECT-REF]`
- **Password**: `<LOCAL_SECRET>`

```bash
DATABASE_PROVIDER=Postgres
ConnectionStrings__SupabaseConnection="Host=aws-0-ap-northeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.drhjfkqeiijdmyettumz;Password=<LOCAL_SECRET>;SSL Mode=Require;Trust Server Certificate=true;"
```

#### Option B: Direct Connection (IPv6 or Dedicated IPv4)
- **Host**: `db.drhjfkqeiijdmyettumz.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: `<LOCAL_SECRET>`

```bash
DATABASE_PROVIDER=Postgres
ConnectionStrings__SupabaseConnection="Host=db.drhjfkqeiijdmyettumz.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<LOCAL_SECRET>;SSL Mode=Require;Trust Server Certificate=true;"
```

---

## 4. Setup Steps for Supabase

1. **Target Supabase Project Details**:
   - **Project Reference**: `drhjfkqeiijdmyettumz`
   - **Dashboard**: `https://supabase.com/dashboard/project/drhjfkqeiijdmyettumz`
   - **Region**: `ap-northeast-1`

2. **Execute Database Schema**:
   - In the Supabase project dashboard, open the **SQL Editor**.
   - Copy and paste the complete content of [`database/SuperApp_Supabase.sql`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/database/SuperApp_Supabase.sql).
   - Click **Run** to execute the script.
   - All 28 tables, indexes, constraints, and seed data (roles, categories, admin user) will be created idempotently.

3. **Configure Local Secrets & Start Backend**:
   - Set via `dotnet user-secrets` (recommended):
     ```powershell
     cd D:\FREELANCER\HTTP-EXPNAT-NET\backend\SuperApp.API
     dotnet user-secrets set "ConnectionStrings:SupabaseConnection" "Host=db.drhjfkqeiijdmyettumz.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<YOUR_DATABASE_PASSWORD>;SSL Mode=Require;Trust Server Certificate=true;"
     $env:DATABASE_PROVIDER="Postgres"
     dotnet run --urls "http://localhost:5000"
     ```

4. **Verify Mobile App Connection**:
   - Start Expo: `npx expo start`
   - Mobile app points to `http://localhost:5000/api` (or local IP for physical devices).
   - All API queries and mutations flow transparently into Supabase PostgreSQL.

---

## 5. Local In-Memory Development

For rapid local frontend development without running any database servers:

```powershell
cd D:\FREELANCER\HTTP-EXPNAT-NET\backend\SuperApp.API
$env:DATABASE_PROVIDER="InMemory"
dotnet run --urls "http://localhost:5000"
```

The database initializes automatically in RAM with default seed data:
- Admin user: `9999999999` (Password: `Admin@123`)
- 5 User Roles
- 8 Marketplace Categories

---

## 6. Device Push Token Endpoint

As part of the database and mobile alignment, the backend includes the device push token registration endpoint:

- **Route**: `POST /api/notifications/device-token`
- **Payload**:
  ```json
  {
    "token": "ExponentPushToken[xxxxxxxxxxxx]",
    "platform": "android",
    "deviceType": "Pixel 8 Pro",
    "registeredAt": "2026-09-17T17:30:00.000Z"
  }
  ```
- **Table**: `user_device_tokens` (DbSet `UserDeviceTokens`)
- **Behavior**: Creates or updates the active token for the authenticated user (or default user in dev).

---

## 7. Automated Testing & Verification

Run the full .NET backend test suite (46 unit tests covering provider switching, EF Core options resolution, and controllers):

```powershell
cd D:\FREELANCER\HTTP-EXPNAT-NET\backend
dotnet test
```

Run mobile app tests and verification:

```powershell
cd D:\FREELANCER\HTTP-EXPNAT-NET
npm test
npx tsc --noEmit
npx expo-doctor
```
