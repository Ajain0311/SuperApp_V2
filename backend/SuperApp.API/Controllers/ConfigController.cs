using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly AppDbContext _db;

    public ConfigController(IConfiguration config, AppDbContext db)
    {
        _config = config;
        _db = db;
    }

    /// <summary>
    /// Public Help &amp; Support contact/FAQ configured by admin (AppSettings).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("support")]
    public async Task<ActionResult<ApiResponse<SupportConfigDto>>> GetSupportConfig()
    {
        var dto = await SupportSettings.LoadAsync(_db);
        return Ok(ApiResponse<SupportConfigDto>.Ok(dto));
    }

    /// <summary>
    /// Provides client-safe runtime configuration, including Mapbox token,
    /// payment public key, and environment flags so mobile client builds do not
    /// need hardcoded credentials.
    /// </summary>
    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<ClientConfigDto>>> GetConfig()
    {
        var mapboxToken = Environment.GetEnvironmentVariable("MAPBOX_ACCESS_TOKEN")
            ?? _config["Mapbox:AccessToken"]
            ?? string.Empty;

        // Also check if admin configured mapbox token in AppSettings
        if (string.IsNullOrWhiteSpace(mapboxToken))
        {
            var setting = await _db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.SettingKey == "mapbox_access_token");
            if (setting != null && !string.IsNullOrWhiteSpace(setting.SettingValue))
            {
                mapboxToken = setting.SettingValue.Trim();
            }
        }

        var mapProvider = Environment.GetEnvironmentVariable("MAP_PROVIDER")
            ?? _config["Providers:Map"]
            ?? "Mapbox";

        var paymentProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER")
            ?? _config["Providers:Payment"]
            ?? "Razorpay";

        var paymentKey = Environment.GetEnvironmentVariable("PAYMENT_KEY")
            ?? _config["Payment:Key"]
            ?? string.Empty;

        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? _config["Environment"]
            ?? "Production";

        var showTestOtp = string.Equals(Environment.GetEnvironmentVariable("SHOW_TEST_OTP"), "true", StringComparison.OrdinalIgnoreCase);

        var dto = new ClientConfigDto
        {
            MapProvider = mapProvider,
            MapboxAccessToken = mapboxToken,
            PaymentProvider = paymentProvider,
            PaymentKeyId = string.IsNullOrWhiteSpace(paymentKey) ? null : paymentKey,
            Environment = env,
            ShowTestOtp = showTestOtp,
            ApiBaseUrl = $"{Request.Scheme}://{Request.Host}/api",
            SignalRHubUrl = $"{Request.Scheme}://{Request.Host}"
        };

        return Ok(ApiResponse<ClientConfigDto>.Ok(dto));
    }
}

