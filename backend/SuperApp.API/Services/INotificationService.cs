namespace SuperApp.API.Services;

public interface INotificationService
{
    Task<bool> SendPushNotificationAsync(long userId, string title, string body, string type, string? referenceId = null);
    Task<bool> SendBroadcastNotificationAsync(string title, string body, string module);
}
