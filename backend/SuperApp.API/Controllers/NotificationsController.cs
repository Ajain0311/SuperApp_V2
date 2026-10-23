using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public NotificationsController(AppDbContext db)
    {
        _db = db;
    }

    private long? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    /// <summary>
    /// Get in-app alerts and push history for current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Notification>>>> GetNotifications()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<List<Notification>>.Fail("Authentication required"));

        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId.Value)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

        return Ok(ApiResponse<List<Notification>>.Ok(notifications));
    }

    /// <summary>
    /// Trigger an instant witty notification (e.g. for testing Zomato pickup lines)
    /// </summary>
    [HttpPost("witty-alert")]
    public async Task<ActionResult<ApiResponse<Notification>>> TriggerWittyAlert([FromQuery] string? type)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<Notification>.Fail("Authentication required"));

        var (title, body) = type?.ToUpperInvariant() switch
        {
            "RIDE" => WittyNotificationCatalog.GetRandomRideLine(),
            "SELLER" or "MARKETPLACE" => WittyNotificationCatalog.GetRandomSellerLine(),
            _ => WittyNotificationCatalog.GetRandomLateNightLine()
        };

        var notification = new Notification
        {
            UserId = userId.Value,
            Title = title,
            Body = body,
            Type = type?.ToUpperInvariant() ?? "FOOD_ORDER",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<Notification>.Ok(notification, "Witty alert generated successfully"));
    }

    /// <summary>
    /// Mark single notification as read
    /// </summary>
    [HttpPut("{id}/read")]
    public async Task<ActionResult<ApiResponse>> MarkAsRead(long id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var notif = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId.Value);
        if (notif != null)
        {
            notif.IsRead = true;
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse.Ok("Notification marked as read"));
    }

    /// <summary>
    /// Mark all notifications as read
    /// </summary>
    [HttpPut("read-all")]
    public async Task<ActionResult<ApiResponse>> MarkAllAsRead()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var unread = await _db.Notifications.Where(n => n.UserId == userId.Value && !n.IsRead).ToListAsync();
        foreach (var n in unread)
        {
            n.IsRead = true;
        }
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("All notifications marked as read"));
    }

    /// <summary>
    /// Register or update device push token for notifications
    /// </summary>
    [HttpPost("device-token")]
    public async Task<ActionResult<ApiResponse>> RegisterDeviceToken([FromBody] RegisterDeviceTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Token))
        {
            return BadRequest(ApiResponse.Fail("Device token is required"));
        }

        var cleanToken = request.Token.Trim();
        if (cleanToken.Length < 10)
        {
            return BadRequest(ApiResponse.Fail("Device token format is invalid"));
        }

        // Column MaxLength(500) — reject before SaveChanges to avoid DbUpdateException 500.
        if (cleanToken.Length > 500)
        {
            return BadRequest(ApiResponse.Fail("Device token is too long (max 500 characters)"));
        }

        var platform = string.IsNullOrWhiteSpace(request.Platform) ? "expo" : request.Platform.Trim();
        if (platform.Length > 50)
        {
            return BadRequest(ApiResponse.Fail("Platform is too long (max 50 characters)"));
        }

        string? deviceType = string.IsNullOrWhiteSpace(request.DeviceType) ? null : request.DeviceType.Trim();
        if (deviceType != null && deviceType.Length > 100)
        {
            return BadRequest(ApiResponse.Fail("Device type is too long (max 100 characters)"));
        }

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        try
        {
            var existing = await _db.UserDeviceTokens
                .FirstOrDefaultAsync(t => t.UserId == userId.Value && t.DeviceToken == cleanToken);

            if (existing == null)
            {
                _db.UserDeviceTokens.Add(new UserDeviceToken
                {
                    UserId = userId.Value,
                    DeviceToken = cleanToken,
                    Platform = platform,
                    DeviceType = deviceType,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.IsActive = true;
                existing.Platform = platform;
                existing.DeviceType = deviceType ?? existing.DeviceType;
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return Ok(ApiResponse.Ok("Device token registered successfully"));
        }
        catch (DbUpdateException)
        {
            return BadRequest(ApiResponse.Fail("Device token could not be saved"));
        }
    }

    /// <summary>
    /// Unregister a specific device push token on logout
    /// </summary>
    [HttpPost("unregister-device-token")]
    public async Task<ActionResult<ApiResponse>> UnregisterDeviceToken([FromBody] RegisterDeviceTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Token))
        {
            return BadRequest(ApiResponse.Fail("Device token is required"));
        }

        var cleanToken = request.Token.Trim();
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var tokens = await _db.UserDeviceTokens
            .Where(t => t.UserId == userId.Value && t.DeviceToken == cleanToken)
            .ToListAsync();

        foreach (var t in tokens)
        {
            t.IsActive = false;
            t.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("Device token unregistered successfully"));
    }

    /// <summary>
    /// Safe diagnostics status check for push notification services
    /// Exposes no secret keys, credentials, or private tokens.
    /// </summary>
    [HttpGet("diagnostics")]
    public async Task<ActionResult<ApiResponse<object>>> GetDiagnostics([FromServices] INotificationService notificationService, [FromServices] IConfiguration config)
    {
        var provider = Environment.GetEnvironmentVariable("NOTIFICATION_PROVIDER")
            ?? config["Notification:Provider"]
            ?? "Expo";

        var fcmConfigured = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FCM_SERVER_KEY") ?? config["Firebase:ServerKey"])
            || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT_JSON") ?? config["Firebase:ServiceAccountJson"]);

        var expoConfigured = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("EXPO_ACCESS_TOKEN") ?? config["Expo:AccessToken"])
            || string.Equals(provider, "Expo", StringComparison.OrdinalIgnoreCase);

        var activeTokensCount = await _db.UserDeviceTokens.CountAsync(t => t.IsActive && !string.IsNullOrEmpty(t.DeviceToken));
        var activeCaptainsTokensCount = await _db.UserDeviceTokens
            .Where(t => t.IsActive && !string.IsNullOrEmpty(t.DeviceToken) && _db.Drivers.Select(d => d.UserId).Contains(t.UserId))
            .CountAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            provider,
            expoConfigured,
            fcmConfigured,
            activeTokensCount,
            activeCaptainsTokensCount,
            status = "Ready"
        }));
    }
}


