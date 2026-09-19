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

// 2. OTP / SMS Provider (Mock in development; PunjabGov / Live SMS in production)
var otpProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER") 
    ?? builder.Configuration["Providers:Otp"] 
    ?? "PunjabGov";

builder.Services.AddHttpClient<PunjabGovSmsService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<ISmsService>(sp => sp.GetRequiredService<PunjabGovSmsService>());
builder.Services.AddScoped<MockOtpService>();
builder.Services.AddScoped<PunjabGovOtpService>();

if (string.Equals(otpProvider, "Mock", StringComparison.OrdinalIgnoreCase))
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

// 4. Map & Location Provider (Mock in development; Google Maps/Mapbox in production)
var mapProvider = Environment.GetEnvironmentVariable("MAP_PROVIDER") 
    ?? builder.Configuration["Providers:Map"] 
    ?? "Mock";
builder.Services.AddScoped<IMapService, MockMapService>();

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

// --- CORS ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Ensure InMemory database schema and seed data are populated on startup
if (string.Equals(dbProvider, "InMemory", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
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

// --- Real-Time SignalR Hub Endpoints ---
app.MapHub<RideTrackingHub>("/hubs/ride");
app.MapHub<OrderStatusHub>("/hubs/order");
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
