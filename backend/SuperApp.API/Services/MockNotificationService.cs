using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
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

    public async Task<bool> SendBroadcastNotificationAsync(string title, string body, string module)
    {
        _logger.LogInformation("[BroadcastPush] Module: {Module}: {Title} - {Body}", module, title, body);

        var activeUserIds = await _db.Users.Where(u => u.IsActive).Select(u => u.Id).Take(100).ToListAsync();

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
}
