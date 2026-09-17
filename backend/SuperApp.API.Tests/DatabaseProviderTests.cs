using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using System.Security.Claims;
using Xunit;

namespace SuperApp.API.Tests;

public class DatabaseProviderTests
{
    [Fact]
    public void InMemoryProvider_ConfiguresSuccessfully_AndSeedsData()
    {
        // Arrange
        var services = new ServiceCollection();
        var dbName = "Test_InMemory_" + Guid.NewGuid().ToString("N");
        
        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName));

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Act
        var created = db.Database.EnsureCreated();

        // Assert
        Assert.True(created);
        Assert.True(db.Database.IsInMemory());
        Assert.Equal(5, db.Roles.Count());
        Assert.Equal(1, db.Users.Count());
        Assert.Equal(8, db.MarketplaceCategories.Count());
        Assert.NotNull(db.Users.FirstOrDefault(u => u.MobileNumber == "9999999999"));
    }

    [Fact]
    public void PostgresProvider_ConfiguresOptions_WithNpgsqlAndSnakeCase()
    {
        // Arrange
        var testPgConn = "Host=localhost;Port=5432;Database=SuperAppTest;Username=postgres;Password=test;";
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(testPgConn, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
                npgsqlOptions.CommandTimeout(30);
            });
            options.UseSnakeCaseNamingConvention();
        });

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Assert
        Assert.NotNull(db);
        Assert.Equal("Npgsql.EntityFrameworkCore.PostgreSQL", db.Database.ProviderName);
    }

    [Fact]
    public void SqlServerProvider_ConfiguresOptions_WithSqlServer()
    {
        // Arrange
        var testSqlConn = "Server=localhost;Database=SuperAppTest;Trusted_Connection=True;TrustServerCertificate=True;";
        var services = new ServiceCollection();

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlServer(testSqlConn, sqlOptions =>
            {
                sqlOptions.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
                sqlOptions.CommandTimeout(30);
            });
        });

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Assert
        Assert.NotNull(db);
        Assert.Equal("Microsoft.EntityFrameworkCore.SqlServer", db.Database.ProviderName);
    }

    [Theory]
    [InlineData("InMemory", typeof(AppDbContext))]
    [InlineData("Postgres", typeof(AppDbContext))]
    [InlineData("PostgreSQL", typeof(AppDbContext))]
    [InlineData("Supabase", typeof(AppDbContext))]
    [InlineData("SqlServer", typeof(AppDbContext))]
    public void ProviderAgnosticFactory_ResolvesDbContext_ForSupportedProviders(string providerType, Type expectedType)
    {
        // Arrange
        var services = new ServiceCollection();
        var configBuilder = new ConfigurationBuilder();
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"Database:Provider", providerType},
            {"ConnectionStrings:DefaultConnection", "Server=localhost;Database=Test;Trusted_Connection=True;TrustServerCertificate=True;"},
            {"ConnectionStrings:SupabaseConnection", "Host=localhost;Database=Test;Username=postgres;Password=postgres;"},
            {"ConnectionStrings:SqlServerConnection", "Server=localhost;Database=Test;Trusted_Connection=True;TrustServerCertificate=True;"}
        };
        configBuilder.AddInMemoryCollection(inMemorySettings);
        var configuration = configBuilder.Build();

        // Act - simulate Program.cs registration logic
        var dbProvider = configuration["Database:Provider"] ?? "SqlServer";

        if (string.Equals(dbProvider, "InMemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase("Test_Factory_" + Guid.NewGuid()));
        }
        else if (string.Equals(dbProvider, "Postgres", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(dbProvider, "PostgreSQL", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(dbProvider, "Supabase", StringComparison.OrdinalIgnoreCase))
        {
            var pgConn = configuration.GetConnectionString("SupabaseConnection")
                ?? configuration.GetConnectionString("DefaultConnection")!;
            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseNpgsql(pgConn);
                options.UseSnakeCaseNamingConvention();
            });
        }
        else
        {
            var sqlConn = configuration.GetConnectionString("SqlServerConnection")
                ?? configuration.GetConnectionString("DefaultConnection")!;
            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(sqlConn));
        }

        using var sp = services.BuildServiceProvider();
        using var scope = sp.CreateScope();
        var resolvedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Assert
        Assert.NotNull(resolvedDb);
        Assert.IsType(expectedType, resolvedDb);
    }

    [Fact]
    public void AppDbContext_ContainsAll28RequiredDbSets()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("Test_DbSets_" + Guid.NewGuid().ToString("N"))
            .Options;

        using var db = new AppDbContext(options);

        // Assert - verify all 28 core domain DbSets are non-null
        Assert.NotNull(db.Users);
        Assert.NotNull(db.Roles);
        Assert.NotNull(db.UserRoles);
        Assert.NotNull(db.OtpRequests);
        Assert.NotNull(db.Addresses);
        Assert.NotNull(db.Restaurants);
        Assert.NotNull(db.RestaurantUsers);
        Assert.NotNull(db.RestaurantCategories);
        Assert.NotNull(db.FoodItems);
        Assert.NotNull(db.FoodItemAddons);
        Assert.NotNull(db.FoodItemVariants);
        Assert.NotNull(db.FoodOrders);
        Assert.NotNull(db.FoodOrderItems);
        Assert.NotNull(db.Drivers);
        Assert.NotNull(db.Vehicles);
        Assert.NotNull(db.Rides);
        Assert.NotNull(db.MarketplaceCategories);
        Assert.NotNull(db.MarketplaceListings);
        Assert.NotNull(db.ListingImages);
        Assert.NotNull(db.Favorites);
        Assert.NotNull(db.Coupons);
        Assert.NotNull(db.CouponUsages);
        Assert.NotNull(db.Banners);
        Assert.NotNull(db.Reviews);
        Assert.NotNull(db.Notifications);
        Assert.NotNull(db.Payments);
        Assert.NotNull(db.AppSettings);
        Assert.NotNull(db.UserDeviceTokens);
    }

    [Fact]
    public async Task NotificationsController_RegisterDeviceToken_CreatesAndUpdatesToken()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("Test_DeviceTokens_" + Guid.NewGuid().ToString("N"))
            .Options;

        using var db = new AppDbContext(options);
        db.Database.EnsureCreated();

        var controller = new NotificationsController(db);
        var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Name, "AdminUser")
        }, "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = userClaims }
        };

        // Act 1: Register new device token
        var registerResult = await controller.RegisterDeviceToken(new RegisterDeviceTokenRequest
        {
            Token = "ExponentPushToken[Test_1234567890]",
            Platform = "android",
            DeviceType = "Android Simulator",
            RegisteredAt = DateTime.UtcNow.ToString("o")
        });

        // Assert 1
        var okResult = Assert.IsType<OkObjectResult>(registerResult.Result);
        var response = Assert.IsType<ApiResponse>(okResult.Value);
        Assert.True(response.Success);
        Assert.Equal(1, await db.UserDeviceTokens.CountAsync());

        // Act 2: Register existing token (update)
        var updateResult = await controller.RegisterDeviceToken(new RegisterDeviceTokenRequest
        {
            Token = "ExponentPushToken[Test_1234567890]",
            Platform = "android",
            DeviceType = "Physical Pixel 8"
        });

        // Assert 2: Count remains 1, details updated
        Assert.Equal(1, await db.UserDeviceTokens.CountAsync());
        var tokenRecord = await db.UserDeviceTokens.FirstAsync();
        Assert.Equal("Physical Pixel 8", tokenRecord.DeviceType);
        Assert.True(tokenRecord.IsActive);

        // Act 3: Validation failure for empty token
        var invalidResult = await controller.RegisterDeviceToken(new RegisterDeviceTokenRequest
        {
            Token = ""
        });
        Assert.IsType<BadRequestObjectResult>(invalidResult.Result);
    }
}
