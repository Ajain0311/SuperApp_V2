using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public NotificationsController(AppDbContext db)
    {
        _db = db;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1;
    }

    /// <summary>
    /// Get in-app alerts and push history for current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Notification>>>> GetNotifications()
    {
        var userId = GetCurrentUserId();
        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

        if (!notifications.Any())
        {
            // Seed initial witty Zomato-style notifications for instant delight
            var initialSeed = new List<Notification>
            {
                new Notification
                {
                    UserId = userId,
                    Title = "Raat ko biwi wo de ya na de... 🍕😋",
                    Body = "Par hum khana dene zaroor aayenge! Garma-garam pizza order karo, dil khush ho jayega!",
                    Type = "FOOD_ORDER",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow.AddMinutes(-5)
                },
                new Notification
                {
                    UserId = userId,
                    Title = "Bhookh lagi hai kya? 🌙🍔",
                    Body = "Kitchen band ho chuka hai, par humara dil aur delivery dono 24/7 khule hain!",
                    Type = "FOOD_ORDER",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow.AddMinutes(-25)
                },
                new Notification
                {
                    UserId = userId,
                    Title = "Ghar baith ke kya karoge? 🚖✨",
                    Body = "Chalo ghoomne! Gaadi darwaze pe khadi hai, seatbelt baandho!",
                    Type = "RIDE",
                    IsRead = true,
                    CreatedAt = DateTime.UtcNow.AddHours(-2)
                },
                new Notification
                {
                    UserId = userId,
                    Title = "Dhamaka! 🎉 Bazaar me naya ad live!",
                    Body = "Puraani cheezon ko kaho bye-bye, jeb me aayegi nayi kamai! 💰📦",
                    Type = "MARKETPLACE",
                    IsRead = true,
                    CreatedAt = DateTime.UtcNow.AddHours(-6)
                }
            };

            _db.Notifications.AddRange(initialSeed);
            await _db.SaveChangesAsync();
            notifications = initialSeed;
        }

        return Ok(ApiResponse<List<Notification>>.Ok(notifications));
    }

    /// <summary>
    /// Trigger an instant witty notification (e.g. for testing Zomato pickup lines)
    /// </summary>
    [HttpPost("witty-alert")]
    public async Task<ActionResult<ApiResponse<Notification>>> TriggerWittyAlert([FromQuery] string? type)
    {
        var userId = GetCurrentUserId();
        var (title, body) = type?.ToUpperInvariant() switch
        {
            "RIDE" => WittyNotificationCatalog.GetRandomRideLine(),
            "SELLER" or "MARKETPLACE" => WittyNotificationCatalog.GetRandomSellerLine(),
            _ => WittyNotificationCatalog.GetRandomLateNightLine()
        };

        var notification = new Notification
        {
            UserId = userId,
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
        var notif = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
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
        var unread = await _db.Notifications.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
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
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(ApiResponse.Fail("Device token is required"));
        }

        var userId = GetCurrentUserId();
        var existing = await _db.UserDeviceTokens
            .FirstOrDefaultAsync(t => t.UserId == userId && t.DeviceToken == request.Token);

        if (existing == null)
        {
            _db.UserDeviceTokens.Add(new UserDeviceToken
            {
                UserId = userId,
                DeviceToken = request.Token,
                Platform = request.Platform ?? "expo",
                DeviceType = request.DeviceType,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.IsActive = true;
            existing.Platform = request.Platform ?? existing.Platform;
            existing.DeviceType = request.DeviceType ?? existing.DeviceType;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("Device token registered successfully"));
    }
}

