using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class ConfigControllerTests
{
    private AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetConfig_ReturnsConfigWithMapboxAndPaymentKit()
    {
        using var db = CreateDb();
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Mapbox:AccessToken", "pk.test_mapbox_token_12345" },
            { "Providers:Map", "Mapbox" },
            { "Payment:Key", "TEST_KEY_999" },
            { "Providers:Payment", "Easebuzz" },
            { "Environment", "Staging" }
        };

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var controller = new ConfigController(config, db);
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Scheme = "https";
        httpContext.Request.Host = new HostString("superapp.local");
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var actionResult = await controller.GetConfig();
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<ApiResponse<ClientConfigDto>>(okResult.Value);

        Assert.True(response.Success);
        Assert.NotNull(response.Data);
        Assert.Equal("Mapbox", response.Data.MapProvider);
        Assert.Equal("pk.test_mapbox_token_12345", response.Data.MapboxAccessToken);
        Assert.Equal("TEST_KEY_999", response.Data.PaymentKeyId);
        Assert.Equal("https://superapp.local/api", response.Data.ApiBaseUrl);
        Assert.Equal("https://superapp.local", response.Data.SignalRHubUrl);
    }

    [Fact]
    public async Task GetConfig_FallsBackToAppSettingsTable_WhenEnvMissing()
    {
        using var db = CreateDb();
        db.AppSettings.Add(new AppSetting
        {
            SettingKey = "mapbox_access_token",
            SettingValue = "pk.from_db_app_settings",
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder().Build();
        var controller = new ConfigController(config, db);
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Scheme = "https";
        httpContext.Request.Host = new HostString("superapp.local");
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var actionResult = await controller.GetConfig();
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<ApiResponse<ClientConfigDto>>(okResult.Value);

        Assert.True(response.Success);
        Assert.NotNull(response.Data);
        Assert.Equal("pk.from_db_app_settings", response.Data.MapboxAccessToken);
    }
}
