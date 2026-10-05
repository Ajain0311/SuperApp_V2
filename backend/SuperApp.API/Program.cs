using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SuperApp.API.Data;
using SuperApp.API.Hubs;
using SuperApp.API.Middleware;
using SuperApp.API.Services;

// --- Load root or workspace .env file if present ---
var currentDir = Directory.GetCurrentDirectory();
var envCandidates = new[]
{
    Path.Combine(currentDir, ".env"),
    Path.Combine(currentDir, "..", "..", ".env"),
    Path.Combine(AppContext.BaseDirectory, ".env"),
    Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".env")
};
foreach (var envPath in envCandidates)
{
    if (File.Exists(envPath))
    {
        foreach (var line in File.ReadAllLines(envPath))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#")) continue;
            var parts = trimmed.Split('=', 2);
            if (parts.Length == 2)
            {
                var key = parts[0].Trim();
                var value = parts[1].Trim();
                if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                {
                    Environment.SetEnvironmentVariable(key, value);
                }
            }
        }
        break;
    }
}

var builder = WebApplication.CreateBuilder(args);

// --- Database Configuration (Environment-driven & Provider-agnostic) ---
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
         string.Equals(dbProvider, "Supabase", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(dbProvider, "Npgsql", StringComparison.OrdinalIgnoreCase))
{
    var pgConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__SupabaseConnection")
        ?? Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
        ?? builder.Configuration.GetConnectionString("SupabaseConnection")
        ?? builder.Configuration.GetConnectionString("PostgresConnection")
        ?? builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Database=SuperAppDB;Username=postgres;Password=postgres;";

    if (pgConnectionString.Contains("<LOCAL_SECRET>") || pgConnectionString.Contains("<SUPABASE_DB_PASSWORD>"))
    {
        Console.WriteLine("[Database] Supabase connection string contains placeholder secrets. Falling back to InMemory provider for local development.");
        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase("SuperAppInMemoryDb"));
        dbProvider = "InMemory";
    }
    else
    {
        builder.Services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(pgConnectionString, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 3, 
                    maxRetryDelay: TimeSpan.FromSeconds(5), 
                    errorCodesToAdd: null);
                npgsqlOptions.CommandTimeout(30);
            });
            options.UseSnakeCaseNamingConvention();
        });
    }
}
else
{
    var sqlConnectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
        ?? builder.Configuration.GetConnectionString("SqlServerConnection")
        ?? builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Server=localhost;Database=SuperAppDB;Trusted_Connection=true;TrustServerCertificate=true;MultipleActiveResultSets=true;";

    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(sqlConnectionString, sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3, 
                maxRetryDelay: TimeSpan.FromSeconds(5), 
                errorNumbersToAdd: null);
            sqlOptions.CommandTimeout(30);
        }));
}

// --- Authentication (Environment-driven JWT) ---
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? builder.Configuration["Jwt:Secret"] 
    ?? "SuperApp_Development_Secret_Key_2026_Must_Be_At_Least_32_Characters";

var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER")
    ?? builder.Configuration["Jwt:Issuer"] 
    ?? "SuperApp";

var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE")
    ?? builder.Configuration["Jwt:Audience"] 
    ?? "SuperApp";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// --- Provider-Agnostic External Service Abstractions ---
// 1. Storage Provider (Local by default; Azure in production)
var storageProvider = Environment.GetEnvironmentVariable("STORAGE_PROVIDER") 
    ?? builder.Configuration["Providers:Storage"] 
    ?? "Local";

builder.Services.AddScoped<LocalStorageService>();
if (string.Equals(storageProvider, "Azure", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddScoped<IStorageService, AzureBlobStorageService>();
}
else
{
    builder.Services.AddScoped<IStorageService, LocalStorageService>();
}

// 2. OTP / SMS Provider (Mock in development/testing; PunjabGov / Live SMS in production)
var otpTestMode = string.Equals(Environment.GetEnvironmentVariable("OTP_TEST_MODE"), "true", StringComparison.OrdinalIgnoreCase);
var otpProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER") 
    ?? builder.Configuration["Providers:Otp"] 
    ?? (otpTestMode ? "Mock" : "PunjabGov");

builder.Services.AddHttpClient<PunjabGovSmsService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<ISmsService>(sp => sp.GetRequiredService<PunjabGovSmsService>());
builder.Services.AddScoped<MockOtpService>();
builder.Services.AddScoped<PunjabGovOtpService>();

if (otpTestMode || string.Equals(otpProvider, "Mock", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddScoped<IOtpService, MockOtpService>();
}
else
{
    builder.Services.AddScoped<IOtpService, PunjabGovOtpService>();
}

// 3. Payment Gateway Provider (Easebuzz test/live; Mock fallback)
var paymentProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER")
    ?? builder.Configuration["Providers:Payment"]
    ?? "Mock";
var paymentKey = Environment.GetEnvironmentVariable("PAYMENT_KEY")
    ?? builder.Configuration["Payment:Key"];
var paymentSalt = Environment.GetEnvironmentVariable("PAYMENT_SECRET")
    ?? builder.Configuration["Payment:Salt"]
    ?? builder.Configuration["Payment:Secret"];
builder.Services.AddScoped<MockPaymentService>();
builder.Services.AddHttpClient<EasebuzzPaymentService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
var useEasebuzz = string.Equals(paymentProvider, "Easebuzz", StringComparison.OrdinalIgnoreCase)
    && !string.IsNullOrWhiteSpace(paymentKey)
    && !string.IsNullOrWhiteSpace(paymentSalt);
if (useEasebuzz)
{
    builder.Services.AddScoped<IPaymentService>(sp => sp.GetRequiredService<EasebuzzPaymentService>());
}
else
{
    builder.Services.AddScoped<IPaymentService>(sp => sp.GetRequiredService<MockPaymentService>());
}

// 4. Map & Location Provider (Mock default; Mapbox when MAP_PROVIDER=Mapbox + token)
var mapProvider = Environment.GetEnvironmentVariable("MAP_PROVIDER")
    ?? builder.Configuration["Providers:Map"]
    ?? "Mock";
var mapboxToken = Environment.GetEnvironmentVariable("MAPBOX_ACCESS_TOKEN")
    ?? builder.Configuration["Mapbox:AccessToken"]
    ?? string.Empty;
builder.Services.AddHttpClient<MapboxMapService>();
var useMapbox = string.Equals(mapProvider, "Mapbox", StringComparison.OrdinalIgnoreCase)
    && !string.IsNullOrWhiteSpace(mapboxToken);
if (useMapbox)
{
    builder.Services.AddScoped<IMapService>(sp => sp.GetRequiredService<MapboxMapService>());
}
else
{
    builder.Services.AddScoped<IMapService, MockMapService>();
}

// 5. Notification Provider (Mock in development; Firebase FCM in production)
var notificationProvider = Environment.GetEnvironmentVariable("NOTIFICATION_PROVIDER") 
    ?? builder.Configuration["Providers:Notification"] 
    ?? "Mock";
builder.Services.AddScoped<INotificationService, MockNotificationService>();

// 6. Security & Identity Tokens
builder.Services.AddScoped<ITokenService, TokenService>();

// --- SignalR Real-Time Hubs ---
builder.Services.AddSignalR();

// --- Controllers ---
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// --- Swagger ---
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "Super App API", 
        Version = "v1",
        Description = "Super App Backend API - Food Ordering, Ride Booking, Marketplace"
    });
    
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Enter JWT token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "bearer"
    });
    
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// --- CORS (Compatible with Web SignalR credentials & Mobile) ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Ensure database schema and seed data are populated on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (string.Equals(dbProvider, "InMemory", StringComparison.OrdinalIgnoreCase))
    {
        db.Database.EnsureCreated();
    }
    else
    {
        try
        {
            const string createOffersSql = @"
CREATE TABLE IF NOT EXISTS marketplace_offers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id BIGINT NOT NULL,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    offered_price DECIMAL(18,2) NOT NULL,
    message VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_marketplace_offers_listing FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketplace_offers_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_marketplace_offers_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_marketplace_offers_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'))
);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_listing ON marketplace_offers (listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_buyer ON marketplace_offers (buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_offers_seller ON marketplace_offers (seller_id);
";
            db.Database.ExecuteSqlRaw(createOffersSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] marketplace_offers: {ex.Message}");
        }

        try
        {
            const string foodDriverSql = @"
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS driver_id BIGINT NULL;
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_food_orders_driver ON food_orders (driver_id);
";
            db.Database.ExecuteSqlRaw(foodDriverSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] food_orders.driver_id: {ex.Message}");
        }

        try
        {
            const string documentsSql = @"
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_no VARCHAR(40) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    blob_object BYTEA NOT NULL,
    owner_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_documents_document_no UNIQUE (document_no),
    CONSTRAINT fk_documents_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_user_id);
";
            db.Database.ExecuteSqlRaw(documentsSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] documents: {ex.Message}");
        }

        try
        {
            const string fareSql = @"
ALTER TABLE rides ADD COLUMN IF NOT EXISTS fare_breakdown VARCHAR(1000) NULL;
CREATE TABLE IF NOT EXISTS ride_fare_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_type VARCHAR(20) NOT NULL,
    city VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',
    minimum_fare DECIMAL(10,2) NOT NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    included_distance_km DECIMAL(6,2) NOT NULL,
    per_km_rate DECIMAL(8,2) NOT NULL,
    per_minute_rate DECIMAL(8,2) NOT NULL,
    booking_fee DECIMAL(8,2) NOT NULL,
    platform_fee DECIMAL(8,2) NOT NULL,
    night_surcharge_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
    peak_multiplier DECIMAL(6,2) NOT NULL DEFAULT 1,
    tax_percentage DECIMAL(6,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS ride_fare_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(200) NULL,
    additional_amount DECIMAL(8,2) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    vehicle_types VARCHAR(80) NOT NULL DEFAULT 'ALL'
);
INSERT INTO ride_fare_rules (vehicle_type, city, minimum_fare, base_fare, included_distance_km, per_km_rate, per_minute_rate, booking_fee, platform_fee, night_surcharge_percent)
SELECT 'BIKE', 'DEFAULT', 35, 25, 1.5, 8, 1, 5, 4, 10
WHERE NOT EXISTS (SELECT 1 FROM ride_fare_rules WHERE vehicle_type = 'BIKE');
INSERT INTO ride_fare_rules (vehicle_type, city, minimum_fare, base_fare, included_distance_km, per_km_rate, per_minute_rate, booking_fee, platform_fee, night_surcharge_percent)
SELECT 'AUTO', 'DEFAULT', 50, 35, 1.5, 12, 1.5, 8, 5, 10
WHERE NOT EXISTS (SELECT 1 FROM ride_fare_rules WHERE vehicle_type = 'AUTO');
INSERT INTO ride_fare_rules (vehicle_type, city, minimum_fare, base_fare, included_distance_km, per_km_rate, per_minute_rate, booking_fee, platform_fee, night_surcharge_percent)
SELECT 'CAB', 'DEFAULT', 90, 55, 2, 16, 2, 15, 8, 10
WHERE NOT EXISTS (SELECT 1 FROM ride_fare_rules WHERE vehicle_type = 'CAB');
INSERT INTO ride_fare_options (code, name, description, additional_amount)
SELECT 'PRIORITY', 'Priority pickup', 'Shown first to nearby captains', 10
WHERE NOT EXISTS (SELECT 1 FROM ride_fare_options WHERE code = 'PRIORITY');
INSERT INTO ride_fare_options (code, name, description, additional_amount)
SELECT 'CONVENIENCE', 'Extra convenience', 'Preferred pickup handling', 20
WHERE NOT EXISTS (SELECT 1 FROM ride_fare_options WHERE code = 'CONVENIENCE');
INSERT INTO ride_fare_options (code, name, description, additional_amount)
SELECT 'WAITING', 'Extra waiting', 'A few extra minutes at pickup', 30
WHERE NOT EXISTS (SELECT 1 FROM ride_fare_options WHERE code = 'WAITING');
";
            db.Database.ExecuteSqlRaw(fareSql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] ride fares: {ex.Message}");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS title VARCHAR(120) NULL;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_restaurant_id BIGINT NULL;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle VARCHAR(300) NULL;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_text VARCHAR(80) NULL;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS chk_coupons_module;
ALTER TABLE coupons ADD CONSTRAINT chk_coupons_module CHECK (applicable_module IN ('FOOD', 'RIDE', 'MARKETPLACE', 'ALL'));
");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] coupons/banners: {ex.Message}");
        }
    }
}

// --- Middleware Pipeline ---
app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// --- Health Check Probe (Used by Deployment & Nginx) ---
app.MapGet("/health", async (AppDbContext db) =>
{
    try
    {
        var canConnect = await db.Database.CanConnectAsync();
        if (canConnect)
        {
            return Results.Ok(new 
            { 
                status = "Healthy", 
                message = "SuperApp V2 Production Live CI/CD Verified",
                version = Environment.GetEnvironmentVariable("APP_VERSION") ?? "1.0.1",
                timestamp = DateTime.UtcNow 
            });
        }
        return Results.Problem(detail: "Database connection unreachable", statusCode: 503);
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 503);
    }
});

// --- Real-Time SignalR Hub Endpoints ---
app.MapHub<RideTrackingHub>("/hubs/ride");
app.MapHub<OrderStatusHub>("/hubs/order");
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
