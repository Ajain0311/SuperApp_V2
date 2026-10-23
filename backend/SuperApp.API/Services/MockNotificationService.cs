using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class MockNotificationService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly ILogger<MockNotificationService> _logger;

    public MockNotificationService(AppDbContext db, ILogger<MockNotificationService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> SendPushNotificationAsync(long userId, string title, string body, string type, string? referenceId = null)
    {
        _logger.LogInformation("[PushNotification] To User #{UserId}: [{Type}] {Title} - {Body}", userId, type, title, body);

        var notification = new Notification
        {
            UserId = userId,
            Title = title,
            Body = body,
            Type = type.ToUpperInvariant(),
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SendBroadcastNotificationAsync(string title, string body, string module, bool persistInApp = true)
    {
        _logger.LogInformation("[BroadcastPush] Module: {Module}: {Title} - {Body} persist={Persist}", module, title, body, persistInApp);

        if (!persistInApp)
            return true;

        var activeUserIds = await _db.Users.Where(u => u.IsActive).OrderBy(u => u.Id).Select(u => u.Id).Take(2000).ToListAsync();

        foreach (var id in activeUserIds)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = id,
                Title = title,
                Body = body,
                Type = module.ToUpperInvariant(),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<PushDispatchResult> BroadcastRideToAllCaptainsAsync(Ride ride)
    {
        _logger.LogInformation("[MockNotification] Broadcasting ride #{RideNumber} (ID {RideId}) to all registered captains", ride.RideNumber, ride.Id);

        // Fetch all registered captains (do NOT filter by IsOnline)
        var captainUserIds = await _db.Drivers
            .Where(d => d.IsActive)
            .Select(d => d.UserId)
            .Distinct()
            .ToListAsync();

        if (!captainUserIds.Any())
        {
            return PushDispatchResult.NoCaptains();
        }

        var tokens = await _db.UserDeviceTokens
            .Where(t => t.IsActive && captainUserIds.Contains(t.UserId) && !string.IsNullOrEmpty(t.DeviceToken))
            .ToListAsync();

        // Create in-app notification records for all captains
        foreach (var userId in captainUserIds)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "🚖 New Ride Request!",
                Body = $"Pickup: {ride.PickupAddress} -> Drop: {ride.DropoffAddress} (₹{ride.EstimatedFare:F0})",
                Type = "RIDE_REQUEST",
                ReferenceId = ride.Id.ToString(),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
        await _db.SaveChangesAsync();

        return PushDispatchResult.Success(
            captainsFound: captainUserIds.Count,
            tokensAttempted: tokens.Count,
            tokensSucceeded: tokens.Count,
            tokensFailed: 0,
            tokensPruned: 0,
            message: $"Mock broadcast dispatched to {captainUserIds.Count} captains ({tokens.Count} tokens)");
    }
}

