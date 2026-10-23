using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class PushNotificationDispatcherService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly ILogger<PushNotificationDispatcherService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public PushNotificationDispatcherService(
        AppDbContext db,
        ILogger<PushNotificationDispatcherService> logger,
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _db = db;
        _logger = logger;
        _httpClient = httpClient;
        _configuration = configuration;
    }

    /// <summary>
    /// Checks whether credentials (Firebase / Expo Access Token) are available.
    /// Returns true if configured, false if missing.
    /// </summary>
    public (bool isConfigured, string reason) CheckCredentials()
    {
        var fcmKey = Environment.GetEnvironmentVariable("FCM_SERVER_KEY")
            ?? Environment.GetEnvironmentVariable("FIREBASE_SERVER_KEY")
            ?? _configuration["Firebase:ServerKey"];

        var fcmServiceAccount = Environment.GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT_JSON")
            ?? Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
            ?? _configuration["Firebase:ServiceAccountJson"];

        var expoAccessToken = Environment.GetEnvironmentVariable("EXPO_ACCESS_TOKEN")
            ?? _configuration["Expo:AccessToken"];

        var provider = Environment.GetEnvironmentVariable("NOTIFICATION_PROVIDER")
            ?? _configuration["Notification:Provider"]
            ?? "Expo";

        // Expo push service accepts public delivery requests without requiring an access token,
        // although setting EXPO_ACCESS_TOKEN is recommended for higher throughput and enhanced security.
        if (string.Equals(provider, "Expo", StringComparison.OrdinalIgnoreCase))
        {
            return (true, string.IsNullOrWhiteSpace(expoAccessToken)
                ? "Expo push service active (standard public tier)"
                : "Expo push service active with EXPO_ACCESS_TOKEN");
        }

        // Check if any valid push gateway credential is configured
        if (!string.IsNullOrWhiteSpace(fcmKey) ||
            !string.IsNullOrWhiteSpace(fcmServiceAccount) ||
            !string.IsNullOrWhiteSpace(expoAccessToken))
        {
            return (true, "Push gateway credentials present");
        }

        return (false, "Missing FCM_SERVER_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, or EXPO_ACCESS_TOKEN.");
    }

    public async Task<bool> SendPushNotificationAsync(long userId, string title, string body, string type, string? referenceId = null)
    {
        // 1. Record In-App notification
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

        // 2. Fetch user's active device tokens
        var tokens = await _db.UserDeviceTokens
            .Where(t => t.UserId == userId && t.IsActive && !string.IsNullOrEmpty(t.DeviceToken))
            .ToListAsync();

        if (!tokens.Any())
        {
            return true;
        }

        var (isConfigured, reason) = CheckCredentials();
        if (!isConfigured)
        {
            _logger.LogWarning("[PushDispatch] Push delivery BLOCKED for User #{UserId}: {Reason}", userId, reason);
            return false;
        }

        var payload = new
        {
            title,
            body,
            data = new
            {
                module = type.ToUpperInvariant(),
                referenceId,
                timestamp = DateTime.UtcNow.ToString("o")
            }
        };

        await SendToTokensAsync(tokens, payload);
        return true;
    }

    public async Task<bool> SendBroadcastNotificationAsync(string title, string body, string module, bool persistInApp = true)
    {
        var activeUserIds = await _db.Users.Where(u => u.IsActive).OrderBy(u => u.Id).Select(u => u.Id).Take(2000).ToListAsync();
        if (persistInApp)
        {
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
        }

        var tokens = await _db.UserDeviceTokens
            .Where(t => t.IsActive && activeUserIds.Contains(t.UserId) && !string.IsNullOrEmpty(t.DeviceToken))
            .ToListAsync();

        if (!tokens.Any()) return true;

        var (isConfigured, reason) = CheckCredentials();
        if (!isConfigured)
        {
            _logger.LogWarning("[PushDispatch] Broadcast push BLOCKED: {Reason}", reason);
            return false;
        }

        var payload = new
        {
            title,
            body,
            data = new
            {
                module = module.ToUpperInvariant(),
                timestamp = DateTime.UtcNow.ToString("o")
            }
        };

        await SendToTokensAsync(tokens, payload);
        return true;
    }

    public async Task<PushDispatchResult> BroadcastRideToAllCaptainsAsync(Ride ride)
    {
        _logger.LogInformation("[PushDispatch] Broadcasting ride #{RideNumber} (ID {RideId}) to ALL registered captains", ride.RideNumber, ride.Id);

        // REQUIREMENT: Notify ALL registered captains regardless of IsOnline (offline or online)
        var captainUserIds = await _db.Drivers
            .Where(d => d.IsActive)
            .Select(d => d.UserId)
            .Distinct()
            .ToListAsync();

        if (!captainUserIds.Any())
        {
            _logger.LogInformation("[PushDispatch] No active registered captains found in the database");
            return PushDispatchResult.NoCaptains();
        }

        // Save in-app notification records for all captains
        foreach (var captainUserId in captainUserIds)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = captainUserId,
                Title = "🚖 New Ride Request!",
                Body = $"Pickup: {ride.PickupAddress} -> Drop: {ride.DropoffAddress} (₹{ride.EstimatedFare:F0})",
                Type = "RIDE_REQUEST",
                ReferenceId = ride.Id.ToString(),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
        await _db.SaveChangesAsync();

        // Get all active device tokens for all registered captains (supports multiple devices per captain)
        var tokens = await _db.UserDeviceTokens
            .Where(t => t.IsActive && captainUserIds.Contains(t.UserId) && !string.IsNullOrEmpty(t.DeviceToken))
            .ToListAsync();

        if (!tokens.Any())
        {
            _logger.LogInformation("[PushDispatch] Found {CaptainCount} captains, but 0 registered active device tokens", captainUserIds.Count);
            return PushDispatchResult.Success(captainUserIds.Count, 0, 0, 0, 0, "No device tokens registered for captains");
        }

        // Check credentials
        var (isConfigured, reason) = CheckCredentials();
        if (!isConfigured)
        {
            _logger.LogWarning("[PushDispatch] Push delivery BLOCKED — credentials required for all {TokenCount} captain device tokens: {Reason}", tokens.Count, reason);
            return PushDispatchResult.Blocked(
                reason: $"BLOCKED — credentials required. {reason}",
                captainsFound: captainUserIds.Count,
                tokensAttempted: tokens.Count);
        }

        // Prepare push payload with essential identifiers only (no sensitive passenger PII)
        var pushData = new
        {
            module = "RIDE_REQUEST",
            rideId = ride.RideNumber,
            rideNumericId = ride.Id,
            pickupAddress = ride.PickupAddress,
            dropoffAddress = ride.DropoffAddress,
            fare = ride.EstimatedFare,
            vehicleType = ride.VehicleType,
            timestamp = DateTime.UtcNow.ToString("o")
        };

        var pushPayload = new
        {
            title = "🚖 New Ride Request Available!",
            body = $"Pickup: {ride.PickupAddress} -> ₹{ride.EstimatedFare:F0}",
            data = pushData
        };

        var (succeeded, failed, pruned) = await SendToTokensAsync(tokens, pushPayload);

        return PushDispatchResult.Success(
            captainsFound: captainUserIds.Count,
            tokensAttempted: tokens.Count,
            tokensSucceeded: succeeded,
            tokensFailed: failed,
            tokensPruned: pruned,
            message: $"Dispatched to {tokens.Count} devices across {captainUserIds.Count} captains ({succeeded} ok, {failed} fail, {pruned} pruned)");
    }

    private async Task<(int succeeded, int failed, int pruned)> SendToTokensAsync(List<UserDeviceToken> tokens, object payload)
    {
        int succeeded = 0;
        int failed = 0;
        int pruned = 0;

        var expoAccessToken = Environment.GetEnvironmentVariable("EXPO_ACCESS_TOKEN")
            ?? _configuration["Expo:AccessToken"];

        var expoTokens = tokens.Where(t => t.DeviceToken.StartsWith("ExponentPushToken", StringComparison.OrdinalIgnoreCase) || t.Platform.Equals("expo", StringComparison.OrdinalIgnoreCase)).ToList();
        var fcmTokens = tokens.Except(expoTokens).ToList();

        // 1. Dispatch Expo tokens
        if (expoTokens.Any())
        {
            var (expoOk, expoFail, expoPruned) = await DispatchExpoBatchAsync(expoTokens, payload, expoAccessToken);
            succeeded += expoOk;
            failed += expoFail;
            pruned += expoPruned;
        }

        // 2. Dispatch direct FCM tokens if any
        if (fcmTokens.Any())
        {
            var (fcmOk, fcmFail, fcmPruned) = await DispatchFcmBatchAsync(fcmTokens, payload);
            succeeded += fcmOk;
            failed += fcmFail;
            pruned += fcmPruned;
        }

        return (succeeded, failed, pruned);
    }

    private async Task<(int succeeded, int failed, int pruned)> DispatchExpoBatchAsync(List<UserDeviceToken> tokens, object payload, string? accessToken)
    {
        int succeeded = 0;
        int failed = 0;
        int pruned = 0;

        // Group into batches of 100 for Expo
        var batches = tokens.Chunk(100).ToList();
        foreach (var batch in batches)
        {
            var messages = new List<object>();
            var tokenMap = new List<UserDeviceToken>();

            foreach (var token in batch)
            {
                // Validate token format
                if (string.IsNullOrWhiteSpace(token.DeviceToken) || token.DeviceToken.Length < 10)
                {
                    token.IsActive = false;
                    token.UpdatedAt = DateTime.UtcNow;
                    pruned++;
                    continue;
                }

                messages.Add(new
                {
                    to = token.DeviceToken,
                    title = GetProperty(payload, "title") ?? "New Ride Request",
                    body = GetProperty(payload, "body") ?? "Tap to view ride",
                    data = GetProperty(payload, "data"),
                    sound = "default",
                    priority = "high",
                    channelId = "ride-requests"
                });
                tokenMap.Add(token);
            }

            if (!messages.Any()) continue;

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://exp.host/--/api/v2/push/send");
                if (!string.IsNullOrWhiteSpace(accessToken))
                {
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                }

                var json = JsonSerializer.Serialize(messages);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseBody);
                    if (doc.RootElement.TryGetProperty("data", out var dataElement) && dataElement.ValueKind == JsonArrayKind())
                    {
                        int index = 0;
                        foreach (var ticket in dataElement.EnumerateArray())
                        {
                            if (index < tokenMap.Count)
                            {
                                var currentToken = tokenMap[index];
                                if (ticket.TryGetProperty("status", out var status) && status.GetString() == "ok")
                                {
                                    succeeded++;
                                }
                                else
                                {
                                    failed++;
                                    if (ticket.TryGetProperty("details", out var details) &&
                                        details.TryGetProperty("error", out var err) &&
                                        err.GetString() == "DeviceNotRegistered")
                                    {
                                        // Revoked or uninstalled device token -> prune
                                        currentToken.IsActive = false;
                                        currentToken.UpdatedAt = DateTime.UtcNow;
                                        pruned++;
                                        _logger.LogInformation("[PushDispatch] Pruning inactive device token #{TokenId}", currentToken.Id);
                                    }
                                }
                            }
                            index++;
                        }
                    }
                    else
                    {
                        succeeded += tokenMap.Count;
                    }
                }
                else
                {
                    failed += tokenMap.Count;
                    _logger.LogError("[PushDispatch] Expo push service error status {StatusCode}", response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                failed += tokenMap.Count;
                _logger.LogError(ex, "[PushDispatch] Failed to send Expo push notification batch");
            }
        }

        if (pruned > 0)
        {
            await _db.SaveChangesAsync();
        }

        return (succeeded, failed, pruned);
    }

    private async Task<(int succeeded, int failed, int pruned)> DispatchFcmBatchAsync(List<UserDeviceToken> tokens, object payload)
    {
        int succeeded = 0;
        int failed = 0;
        int pruned = 0;

        var fcmKey = Environment.GetEnvironmentVariable("FCM_SERVER_KEY")
            ?? Environment.GetEnvironmentVariable("FIREBASE_SERVER_KEY")
            ?? _configuration["Firebase:ServerKey"];

        if (string.IsNullOrWhiteSpace(fcmKey))
        {
            _logger.LogWarning("[PushDispatch] Direct FCM dispatch attempted but FCM_SERVER_KEY is unconfigured.");
            return (0, tokens.Count, 0);
        }

        foreach (var token in tokens)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://fcm.googleapis.com/fcm/send");
                request.Headers.TryAddWithoutValidation("Authorization", $"key={fcmKey}");

                var bodyObj = new
                {
                    to = token.DeviceToken,
                    notification = new
                    {
                        title = GetProperty(payload, "title"),
                        body = GetProperty(payload, "body"),
                        sound = "default"
                    },
                    data = GetProperty(payload, "data"),
                    priority = "high"
                };

                request.Content = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json");
                var response = await _httpClient.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    var resJson = await response.Content.ReadAsStringAsync();
                    if (resJson.Contains("\"failure\":1") || resJson.Contains("NotRegistered") || resJson.Contains("InvalidRegistration"))
                    {
                        token.IsActive = false;
                        token.UpdatedAt = DateTime.UtcNow;
                        pruned++;
                        failed++;
                    }
                    else
                    {
                        succeeded++;
                    }
                }
                else
                {
                    failed++;
                }
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogError(ex, "[PushDispatch] FCM push dispatch error for token #{TokenId}", token.Id);
            }
        }

        if (pruned > 0)
        {
            await _db.SaveChangesAsync();
        }

        return (succeeded, failed, pruned);
    }

    private static object? GetProperty(object obj, string name)
    {
        var prop = obj.GetType().GetProperty(name);
        return prop?.GetValue(obj);
    }

    private static JsonValueKind JsonArrayKind() => JsonValueKind.Array;
}
