using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public interface INotificationService
{
    Task<bool> SendPushNotificationAsync(long userId, string title, string body, string type, string? referenceId = null);
    /// <param name="persistInApp">When false, only device push is attempted (caller already wrote Notification rows).</param>
    Task<bool> SendBroadcastNotificationAsync(string title, string body, string module, bool persistInApp = true);
    Task<PushDispatchResult> BroadcastRideToAllCaptainsAsync(Ride ride);
}

