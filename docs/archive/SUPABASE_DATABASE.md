# SuperApp — Supabase PostgreSQL Database Specification & Migration Guide

## 1. Executive Summary

This document specifies the database architecture for transitioning the **SuperApp** development database to **Supabase** (PostgreSQL 15+).

The generated SQL script is located at [`database/SuperApp_Supabase.sql`](file:///D:/FREELANCER/HTTP-EXPNAT-NET/database/SuperApp_Supabase.sql).

> [!IMPORTANT]
> **Manual Execution Policy**:
> The SQL script is designed for **manual execution** inside the Supabase SQL Editor by the project owner. It has **NOT** been automatically executed against any remote database.

---

## 2. Supabase PostgreSQL vs. Existing SQL Server Comparison

| Dimension | SQL Server 2019 / 2022 (`SuperApp_Database.sql`) | Supabase PostgreSQL (`SuperApp_Supabase.sql`) | Notes & Compatibility |
| :--- | :--- | :--- | :--- |
| **Schema Scope** | `[dbo].[TableName]` | `public.table_name` (snake_case) | Standard Postgres naming convention. |
| **Identity / Autoincrement** | `BIGINT IDENTITY(1,1)` | `BIGINT GENERATED ALWAYS AS IDENTITY` | Standard SQL:2008 identity syntax supported natively in Postgres 10+. |
| **String Data Types** | `NVARCHAR(n)`, `NVARCHAR(MAX)` | `VARCHAR(n)`, `TEXT` | PostgreSQL natively stores strings in UTF-8 without requiring `NVARCHAR`. |
| **Boolean Data Types** | `BIT` (0 or 1) | `BOOLEAN` (`TRUE` or `FALSE`) | Eliminates integer casting in queries. |
| **Date & Time Types** | `DATETIME2(7)`, `TIME(7)` | `TIMESTAMPTZ`, `TIME` | `TIMESTAMPTZ` preserves UTC offset and conforms with ISO 8601. |
| **Default Timestamps** | `SYSUTCDATETIME()`, `GETDATE()` | `clock_timestamp()` | High-resolution UTC timestamp. |
| **Indexes** | `CLUSTERED`, `NONCLUSTERED` | B-Tree (Default Postgres index) | Clustered index semantics are handled by PostgreSQL heap storage. |
| **Filtered Indexes** | `WHERE [Column] IS NOT NULL` | `WHERE column IS NOT NULL` | Direct 1:1 syntax translation. |
| **Script Delimiters** | `GO` | Standard semicolons `;` | `GO` is an SSMS batch terminator not recognized by Postgres. |
| **Extensions** | N/A | `pgcrypto`, `uuid-ossp` | Added for secure random generation and UUID compatibility. |

---

## 3. Equivalent Tables & Domain Mapping

All 27 original entities from the ASP.NET Core `AppDbContext` are preserved 1:1 in PostgreSQL, with the addition of `user_device_tokens` to support the new Expo push notification lifecycle:

| Domain | SQL Server Table | Supabase PostgreSQL Table | Purpose & Parity |
| :--- | :--- | :--- | :--- |
| **Identity** | `[dbo].[Roles]` | `roles` | 5 user roles (`CUSTOMER`, `ADMIN`, `RESTAURANT_OWNER`, `DRIVER`, `MARKETPLACE_SELLER`). |
| **Identity** | `[dbo].[Users]` | `users` | Central user account with phone, bcrypt hash, and activity state. |
| **Identity** | `[dbo].[UserRoles]` | `user_roles` | Many-to-many relationship mapping between users and roles. |
| **Identity** | `[dbo].[OtpRequests]` | `otp_requests` | 6-digit verification codes, attempt counters, and expiration timestamps. |
| **Identity** | `[dbo].[Addresses]` | `addresses` | Customer delivery and pickup addresses with GPS coordinates. |
| **Food** | `[dbo].[Restaurants]` | `restaurants` | Restaurant partner catalog with hours, ratings, and delivery fees. |
| **Food** | `[dbo].[RestaurantUsers]` | `restaurant_users` | Multi-tenant restaurant owner and manager assignments. |
| **Food** | `[dbo].[RestaurantCategories]`| `restaurant_categories` | Menu classification sections (e.g. Biryani Specials, Starters). |
| **Food** | `[dbo].[FoodItems]` | `food_items` | Dishes, base prices, veg badges, and bestseller status. |
| **Food** | `[dbo].[FoodItemVariants]` | `food_item_variants` | Portion sizes (Regular, Jumbo Pack). |
| **Food** | `[dbo].[FoodItemAddons]` | `food_item_addons` | Extra toppings and sides (Raita, Salan). |
| **Food** | `[dbo].[Coupons]` | `coupons` | Percentage and flat promotional discount codes. |
| **Food** | `[dbo].[CouponUsages]` | `coupon_usages` | Per-user redemption tracking and audit. |
| **Food** | `[dbo].[FoodOrders]` | `food_orders` | Orders with status lifecycle, GST taxes, and totals. |
| **Food** | `[dbo].[FoodOrderItems]` | `food_order_items` | Line items with variant name, addon JSON, and totals. |
| **Ride** | `[dbo].[Drivers]` | `drivers` | Driver verification, rating, and online toggle. |
| **Ride** | `[dbo].[Vehicles]` | `vehicles` | Vehicles linked to drivers (`BIKE`, `AUTO`, `CAB`). |
| **Ride** | `[dbo].[Rides]` | `rides` | Trip bookings, pickup/dropoff coordinates, fare, and 4-digit start OTP. |
| **Marketplace**| `[dbo].[MarketplaceCategories]`| `marketplace_categories` | Bazaar categories (Mobiles, Vehicles, Electronics, etc.). |
| **Marketplace**| `[dbo].[MarketplaceListings]` | `marketplace_listings` | Classified advertisements with price, condition, and status. |
| **Marketplace**| `[dbo].[ListingImages]` | `listing_images` | Multi-photo galleries attached to marketplace listings. |
| **Marketplace**| `[dbo].[Favorites]` | `favorites` | Bookmarked listings per customer profile. |
| **Notifications**| `[dbo].[Notifications]` | `notifications` | In-app notification alerts and delivery history. |
| **Notifications**| *(New Table)* | `user_device_tokens` | **Expo Push Notification Tokens** (`expo-notifications` device registration). |
| **Commons** | `[dbo].[Banners]` | `banners` | Home and module promotional marketing banners. |
| **Commons** | `[dbo].[Reviews]` | `reviews` | Customer ratings and reviews for restaurants, drivers, and listings. |
| **Commons** | `[dbo].[Payments]` | `payments` | Transaction records for UPI, Card, and COD payments. |
| **Commons** | `[dbo].[AppSettings]` | `app_settings` | Dynamic platform configuration key-value pairs. |

**Total Tables**: **28 tables**.

---

## 4. Supabase PostgreSQL Database vs. Supabase Auth Decision

### Key Architectural Finding
The current application features a mature, functioning authentication pipeline:
```
Mobile (+91 Phone) ──> POST /api/auth/send-otp ──> SMS / Dev OTP (123456)
                    ──> POST /api/auth/verify-otp ──> ASP.NET Core JWT
                    ──> Mobile SecureStore
```

### Strategic Recommendation
1. **Use Supabase as the Relational Database**:
   - The ASP.NET Core backend connects directly to Supabase PostgreSQL using connection pooling or direct TCP.
   - ASP.NET Core continues to manage JWT issuance, role authorization claims, and password/OTP verification.
2. **Do NOT Enable Supabase Auth**:
   - Supabase Auth uses its own `auth.users` schema, GoTrue microservice, and external JWT signing tokens.
   - Migrating to Supabase Auth would break the current ASP.NET Core `[Authorize]` middleware, the SignalR authentication handlers, and the custom phone OTP verification workflows.
   - Therefore, Supabase is treated purely as an enterprise-grade managed **PostgreSQL database**.

---

## 5. Supabase Row Level Security (RLS) Analysis

- In Supabase, Row Level Security (RLS) is designed for direct client-to-database connections (such as React Native directly calling `@supabase/supabase-js`).
- Because our architecture routes all database queries through the **ASP.NET Core backend**, the backend connects via PostgreSQL connection string with standard database user permissions.
- In PostgreSQL, superuser or table-owning service connections automatically bypass RLS.
- Enabling aggressive RLS policies without backend security contexts could inadvertently restrict backend operations.
- The SQL script provides optional RLS templates commented out in Section 09, allowing future selective activation if direct client query capabilities are introduced.

---

## 6. Required EF Core Provider Migration Steps

To connect the ASP.NET Core backend (`SuperApp.API`) to Supabase PostgreSQL:

### 1. NuGet Packages Added to `SuperApp.API.csproj`
```xml
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.3" />
<PackageReference Include="EFCore.NamingConventions" Version="10.0.1" />
```

### 2. Multi-Provider Configuration in `Program.cs`
The active backend dynamically resolves the provider from `DATABASE_PROVIDER` and prioritizes `ConnectionStrings__SupabaseConnection`:
```csharp
var dbProvider = Environment.GetEnvironmentVariable("DATABASE_PROVIDER") 
    ?? builder.Configuration["Database:Provider"] 
    ?? "SqlServer";

if (string.Equals(dbProvider, "InMemory", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseInMemoryDatabase("SuperAppInMemoryDb"));
}
else if (string.Equals(dbProvider, "Postgres", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(dbProvider, "PostgreSQL", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(dbProvider, "Supabase", StringComparison.OrdinalIgnoreCase))
{
    var pgConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SupabaseConnection")
        ?? Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
        ?? builder.Configuration.GetConnectionString("SupabaseConnection")
        ?? builder.Configuration.GetConnectionString("DefaultConnection");

    builder.Services.AddDbContext<AppDbContext>(options =>
    {
        options.UseNpgsql(pgConnectionString, npgsqlOptions =>
        {
            npgsqlOptions.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
            npgsqlOptions.CommandTimeout(30);
        });
        options.UseSnakeCaseNamingConvention();
    });
}
```

### 3. Target Supabase Infrastructure Details
- **Project Reference**: `drhjfkqeiijdmyettumz`
- **Host**: `db.drhjfkqeiijdmyettumz.supabase.co` (Port `5432`)
- **API URL**: `https://drhjfkqeiijdmyettumz.supabase.co`
- **S3 Storage Endpoint**: `https://drhjfkqeiijdmyettumz.storage.supabase.co/storage/v1/s3` (Region: `ap-northeast-1`)
- **Secrets Policy**: Configured strictly via `dotnet user-secrets` or local session environment variables. Zero credentials committed to git.
