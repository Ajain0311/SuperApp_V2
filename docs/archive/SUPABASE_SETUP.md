# SuperApp — Supabase Project Setup & Connection Guide

## 1. Project Infrastructure Details

| Resource | Value | Notes |
| :--- | :--- | :--- |
| **Project Reference** | `drhjfkqeiijdmyettumz` | Supabase Cloud identifier |
| **API Gateway URL** | `https://drhjfkqeiijdmyettumz.supabase.co` | REST / PostgREST endpoint |
| **PostgreSQL Host** | `db.drhjfkqeiijdmyettumz.supabase.co` | Direct database connection (Port 5432) |
| **Database Name** | `postgres` | Default Supabase database |
| **Port** | `5432` | Standard PostgreSQL port |
| **S3 Storage Endpoint** | `https://drhjfkqeiijdmyettumz.storage.supabase.co/storage/v1/s3` | S3-compatible storage API |
| **Storage Region** | `ap-northeast-1` | Asia Pacific (Tokyo) |
| **Dashboard URL** | `https://supabase.com/dashboard/project/drhjfkqeiijdmyettumz` | Admin web console |

---

## 2. Safe Local Secret Configuration

Per security guidelines, database passwords and production credentials are **NEVER** stored in source control, tracked files, or frontend client builds.

### Option A: ASP.NET Core User Secrets (Recommended for Local Dev)

ASP.NET Core User Secrets stores sensitive configuration outside the repository under `%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json`.

```powershell
# Navigate to active backend project
cd D:\FREELANCER\HTTP-EXPNAT-NET\backend\SuperApp.API

# Configure the Supabase connection string securely
dotnet user-secrets set "ConnectionStrings:SupabaseConnection" "Host=db.drhjfkqeiijdmyettumz.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<YOUR_DATABASE_PASSWORD>;SSL Mode=Require;Trust Server Certificate=true;"
```

### Option B: Local Environment Variables

Alternatively, pass the connection string through your shell environment session:

```powershell
$env:DATABASE_PROVIDER="Postgres"
$env:ConnectionStrings__SupabaseConnection="Host=db.drhjfkqeiijdmyettumz.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<YOUR_DATABASE_PASSWORD>;SSL Mode=Require;Trust Server Certificate=true;"
dotnet run --urls "http://localhost:5000"
```

---

## 3. Database Schema Provisioning Policy

> [!IMPORTANT]
> **Schema Execution Policy**:
> To protect against accidental data loss, schema execution is **never automated** by AI assistants against remote cloud databases. 

To execute the initial SuperApp database schema:
1. Open the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/drhjfkqeiijdmyettumz/sql/new).
2. Open [`database/SuperApp_Supabase.sql`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/database/SuperApp_Supabase.sql) from the repository.
3. Paste the contents into the SQL Editor and click **Run**.
4. The idempotent script creates all 28 tables, indexes, foreign keys, and seed records (Roles, Categories, Admin User).

---

## 4. Architecture & Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Mobile App                      │
│                  (React Native + Expo SDK 57)               │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON & SignalR
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  ASP.NET Core SuperApp.API                  │
│                     (Runs on Port 5000)                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Npgsql / EF Core 10 (SSL)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL Cloud                   │
│               (db.drhjfkqeiijdmyettumz.supabase.co)         │
└─────────────────────────────────────────────────────────────┘
```

- **Zero Direct Mobile Connections**: The React Native Expo client communicates exclusively with the ASP.NET Core API at `http://localhost:5000/api`. It has no direct access to PostgreSQL credentials.
- **Authentication**: JWT token issuance and verification remain strictly managed by ASP.NET Core (`/api/auth/send-otp` and `/api/auth/verify-otp`). Supabase Auth is not used.
- **Storage**: Supabase S3 Storage is documented as infrastructure for future media upload providers and is not integrated into client code in this phase.
