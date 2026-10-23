using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class SupportConfigTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("SupportCfg_" + Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetSupportConfig_SeedsDefaults_AndReturnsDto()
    {
        await using var db = CreateDb();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
        var controller = new ConfigController(config, db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetSupportConfig();
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<SupportConfigDto>>(ok.Value);
        Assert.True(body.Success);
        Assert.False(string.IsNullOrWhiteSpace(body.Data!.Phone));
        Assert.False(string.IsNullOrWhiteSpace(body.Data.WhatsApp));
        Assert.False(string.IsNullOrWhiteSpace(body.Data.Email));
        Assert.False(string.IsNullOrWhiteSpace(body.Data.Hours));
        Assert.Contains("Q:", body.Data.Faq, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(5, db.AppSettings.Count(s => s.SettingKey.StartsWith("support_")));
    }

    [Fact]
    public async Task GetSupportConfig_UsesAdminUpdatedValues()
    {
        await using var db = CreateDb();
        await SupportSettings.EnsureDefaultsAsync(db);
        var phone = db.AppSettings.First(s => s.SettingKey == SupportSettings.PhoneKey);
        phone.SettingValue = "911112223333";
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build();
        var controller = new ConfigController(config, db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.GetSupportConfig();
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<SupportConfigDto>>(ok.Value);
        Assert.Equal("911112223333", body.Data!.Phone);
    }
}
