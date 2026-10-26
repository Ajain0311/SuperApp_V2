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
    // Production publish layout: WorkingDirectory=/opt/SuperApp_V2/dist, .env lives one level up.
    Path.Combine(currentDir, "..", ".env"),
    Path.Combine(currentDir, "..", "..", ".env"),
    Path.Combine(AppContext.BaseDirectory, ".env"),
    Path.Combine(AppContext.BaseDirectory, "..", ".env"),
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
var isProduction = string.Equals(builder.Environment.EnvironmentName, "Production", StringComparison.OrdinalIgnoreCase);

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
    var pgConnectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__PostgresConnection")
        ?? builder.Configuration.GetConnectionString("DefaultConnection")
        ?? builder.Configuration.GetConnectionString("PostgresConnection")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__SupabaseConnection")
        ?? builder.Configuration.GetConnectionString("SupabaseConnection")
        ?? "Host=localhost;Database=SuperAppDB;Username=postgres;Password=postgres;";

    if (pgConnectionString.Contains("<LOCAL_SECRET>") || pgConnectionString.Contains("<SUPABASE_DB_PASSWORD>") || pgConnectionString.Contains("YOUR_DATABASE_PASSWORD_HERE"))
    {
        Console.WriteLine("[Database] Database connection string contains placeholder secrets. Falling back to InMemory provider for local development.");
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
    ?? ProductionSecurityValidator.DefaultDevJwtSecret;

ProductionSecurityValidator.ValidateJwtSecret(jwtSecret, isProduction);

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
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
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

// 2. OTP / SMS Provider (Mock in development/testing; BIGB / 2Factor in production)
var otpTestMode = string.Equals(Environment.GetEnvironmentVariable("OTP_TEST_MODE"), "true", StringComparison.OrdinalIgnoreCase);
var otpProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER") 
    ?? builder.Configuration["Providers:Otp"] 
    ?? (otpTestMode ? "Mock" : "BIGB");

// SMS Provider Selection:
// 1 = BIGB SMS Provider (current)
// 2 = 2Factor.in SMS Provider (new)
var smsProviderConfig = Environment.GetEnvironmentVariable("SMS_PROVIDER") 
    ?? builder.Configuration["Providers:SmsProvider"] 
    ?? "1"; // Default to 1 (BIGB)

builder.Services.AddHttpClient<BigBSmsService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddHttpClient<TwoFactorSmsService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});

if (smsProviderConfig == "2" || string.Equals(smsProviderConfig, "TwoFactor", StringComparison.OrdinalIgnoreCase))
{
    // 2Factor.in SMS Provider (Active)
    builder.Services.AddScoped<ISmsService>(sp => sp.GetRequiredService<TwoFactorSmsService>());
}
else
{
    // Option 1: BIGB SMS Provider
    builder.Services.AddScoped<ISmsService>(sp => sp.GetRequiredService<BigBSmsService>());
}

// Previous hardcoded provider (commented out):
// builder.Services.AddScoped<ISmsService>(sp => sp.GetRequiredService<BigBSmsService>());

builder.Services.AddScoped<MockOtpService>();
builder.Services.AddScoped<BigBOtpService>();
ProductionSecurityValidator.ValidateOtpProvider(otpProvider, otpTestMode, isProduction);

// OTP_TEST_MODE with an explicit live provider (BIGB) must keep that provider.
// BigBOtpService honors TEST_OTP and skips SMS when OTP_TEST_MODE=true outside Production.
// Selecting MockOtpService while OTP_PROVIDER=BIGB throws at resolve-time and breaks all auth.
if (string.Equals(otpProvider, "BIGB", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddScoped<IOtpService, BigBOtpService>();
}
else if (otpTestMode || string.Equals(otpProvider, "Mock", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddScoped<MockOtpService>();
    builder.Services.AddScoped<IOtpService, MockOtpService>();
}
else
{
    builder.Services.AddScoped<IOtpService, BigBOtpService>();
}

// 3. Payment Gateway Provider (Razorpay test/live; Mock fallback)
var paymentProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER")
    ?? builder.Configuration["Providers:Payment"]
    ?? "Razorpay";
var paymentKey = Environment.GetEnvironmentVariable("RAZORPAY_KEY_ID")
    ?? Environment.GetEnvironmentVariable("PAYMENT_KEY")
    ?? builder.Configuration["Razorpay:KeyId"]
    ?? builder.Configuration["Payment:Key"];
var paymentSecret = Environment.GetEnvironmentVariable("RAZORPAY_KEY_SECRET")
    ?? Environment.GetEnvironmentVariable("PAYMENT_SECRET")
    ?? builder.Configuration["Razorpay:KeySecret"]
    ?? builder.Configuration["Payment:Secret"];

builder.Services.AddScoped<MockPaymentService>();
builder.Services.AddScoped<RazorpayPaymentService>();

var useRazorpay = (string.Equals(paymentProvider, "Razorpay", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(paymentProvider, "Easebuzz", StringComparison.OrdinalIgnoreCase))
    && !string.IsNullOrWhiteSpace(paymentKey)
    && !string.IsNullOrWhiteSpace(paymentSecret);

ProductionSecurityValidator.ValidatePaymentProvider(paymentProvider, paymentKey, paymentSecret, isProduction);

if (useRazorpay)
{
    builder.Services.AddScoped<IPaymentService>(sp => sp.GetRequiredService<RazorpayPaymentService>());
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

ProductionSecurityValidator.ValidateMapProvider(mapProvider, mapboxToken, isProduction);

if (useMapbox)
{
    builder.Services.AddScoped<IMapService>(sp => sp.GetRequiredService<MapboxMapService>());
}
else
{
    builder.Services.AddScoped<IMapService, MockMapService>();
}

// 5. Notification Provider (Mock in development; PushNotificationDispatcher in production or when configured)
var notificationProvider = Environment.GetEnvironmentVariable("NOTIFICATION_PROVIDER") 
    ?? builder.Configuration["Providers:Notification"] 
    ?? (isProduction ? "Expo" : "Mock");
builder.Services.AddHttpClient<PushNotificationDispatcherService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<MockNotificationService>();

ProductionSecurityValidator.ValidateNotificationProvider(notificationProvider, isProduction);

if (string.Equals(notificationProvider, "Push", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(notificationProvider, "Fcm", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(notificationProvider, "Firebase", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(notificationProvider, "Expo", StringComparison.OrdinalIgnoreCase) ||
    isProduction)
{
    builder.Services.AddScoped<INotificationService>(sp => sp.GetRequiredService<PushNotificationDispatcherService>());
}
else
{
    builder.Services.AddScoped<INotificationService, MockNotificationService>();
}

// 6. Security & Identity Tokens
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<RoleApplicationService>();


// 7. Background Services
builder.Services.AddHostedService<PushNotificationSchedulerService>();
builder.Services.AddHostedService<RideExpiryBackgroundService>();

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
var configuredOrigins = builder.Configuration.GetSection("AppSettings:CorsAllowedOrigins").Get<string[]>()
    ?? new[] { "https://makemytree.duckdns.org", "http://localhost:8081", "http://127.0.0.1:8081" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        if (isProduction && configuredOrigins != null && configuredOrigins.Length > 0)
        {
            policy.WithOrigins(configuredOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
        else
        {
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
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
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS checkout_group_id VARCHAR(40) NULL;
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS commission_rate_percent DECIMAL(5,2) NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS commission_rate_percent DECIMAL(5,2) NULL;
CREATE INDEX IF NOT EXISTS idx_food_orders_checkout_group ON food_orders (checkout_group_id);
CREATE TABLE IF NOT EXISTS hotel_settlement_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_number VARCHAR(40) NOT NULL,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    order_count INT NOT NULL DEFAULT 0,
    total_commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_settled_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    reference_proof VARCHAR(100) NULL,
    approved_by_admin_id BIGINT NULL REFERENCES users(id),
    approved_by_admin_name VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE NULL
);
CREATE TABLE IF NOT EXISTS hotel_commission_ledgers (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    food_order_id BIGINT NOT NULL REFERENCES food_orders(id) ON DELETE CASCADE,
    order_number VARCHAR(30) NOT NULL,
    commission_base_amount DECIMAL(10,2) NOT NULL,
    commission_rate_percent DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    net_hotel_proceeds DECIMAL(10,2) NOT NULL,
    platform_funded_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    settlement_batch_id BIGINT NULL REFERENCES hotel_settlement_batches(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT uq_hotel_commission_food_order UNIQUE (food_order_id)
);
CREATE INDEX IF NOT EXISTS idx_commission_restaurant ON hotel_commission_ledgers (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON hotel_commission_ledgers (status);
ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle VARCHAR(300) NULL;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_text VARCHAR(80) NULL;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS chk_coupons_module;
ALTER TABLE coupons ADD CONSTRAINT chk_coupons_module CHECK (applicable_module IN ('FOOD', 'RIDE', 'MARKETPLACE', 'ALL'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS chat_conversations (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    buyer_id BIGINT NOT NULL REFERENCES users(id),
    seller_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_conversations_listing_buyer UNIQUE (listing_id, buyer_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id),
    message_text VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE TABLE IF NOT EXISTS role_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    requested_role VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    license_number VARCHAR(50) NULL,
    license_document_no VARCHAR(40) NULL,
    vehicle_type VARCHAR(20) NULL,
    vehicle_registration_number VARCHAR(30) NULL,
    vehicle_make VARCHAR(40) NULL,
    vehicle_model VARCHAR(40) NULL,
    hotel_name VARCHAR(150) NULL,
    hotel_address VARCHAR(300) NULL,
    hotel_city VARCHAR(80) NULL,
    hotel_phone VARCHAR(20) NULL,
    business_document_no VARCHAR(40) NULL,
    applicant_notes VARCHAR(500) NULL,
    admin_notes VARCHAR(500) NULL,
    reviewed_by_admin_id BIGINT NULL REFERENCES users(id),
    reviewed_by_admin_name VARCHAR(100) NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE NULL,
    result_restaurant_id BIGINT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NULL
);
CREATE INDEX IF NOT EXISTS ix_role_applications_user_id ON role_applications(user_id);
CREATE INDEX IF NOT EXISTS ix_role_applications_status ON role_applications(status);
-- App DB user must own/read this table (table may have been created earlier as postgres)
GRANT ALL PRIVILEGES ON TABLE role_applications TO CURRENT_USER;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;
");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] coupons/banners/users: {ex.Message}");
        }

        // Best-effort: if role_applications was created by a different DB role, re-grant access.
        try
        {
            db.Database.ExecuteSqlRaw(@"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_applications'
  ) THEN
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE role_applications TO CURRENT_USER';
  END IF;
END $$;");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] role_applications grants: {ex.Message}");
        }

        // Synchronize all PostgreSQL sequences with existing max table IDs to prevent identity collisions
        try
        {
            db.Database.ExecuteSqlRaw(@"
DO $$
DECLARE
    r RECORD;
    max_id BIGINT;
BEGIN
    FOR r IN (
        SELECT t.table_name, c.column_name, pg_get_serial_sequence(quote_ident(t.table_name), c.column_name) AS seq_name
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ) LOOP
        IF r.seq_name IS NOT NULL THEN
            BEGIN
                EXECUTE format('SELECT MAX(%I) FROM %I', r.column_name, r.table_name) INTO max_id;
                IF max_id IS NOT NULL AND max_id > 0 THEN
                    EXECUTE format('SELECT setval(%L, %s, true)', r.seq_name, max_id);
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;
    END LOOP;
END $$;");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schema Check] sequence sync: {ex.Message}");
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
