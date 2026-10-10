using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SuperApp.API.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace SuperApp.API.Services;

public class PushNotificationSchedulerService : BackgroundService
{
    private readonly ILogger<PushNotificationSchedulerService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly HttpClient _httpClient;

    public PushNotificationSchedulerService(ILogger<PushNotificationSchedulerService> logger, IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
        _httpClient = new HttpClient();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PushNotificationSchedulerService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            DateTime now;
            try 
            {
                now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"));
            }
            catch (TimeZoneNotFoundException)
            {
                // Fallback for non-Windows environments if TZ is missing
                now = DateTime.UtcNow.AddHours(5).AddMinutes(30); 
            }
            
            // Check for lunch deal at 12:30
            if (now.Hour == 12 && now.Minute == 30)
            {
                await SendBroadcastAsync("Hungry?", "Check out our exclusive lunch deals now!", stoppingToken);
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); // Prevent multiple triggers in the same minute
            }
            // Check for evening rides at 18:00
            else if (now.Hour == 18 && now.Minute == 0)
            {
                await SendBroadcastAsync("Time to commute?", "Book a ride with us for a safe and comfortable journey.", stoppingToken);
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            // Check for dinner specials at 20:00
            else if (now.Hour == 20 && now.Minute == 0)
            {
                await SendBroadcastAsync("Dinner Time!", "Craving something delicious? Explore our dinner specials.", stoppingToken);
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); // Check every 30 seconds
        }
    }

    private async Task SendBroadcastAsync(string title, string body, CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation($"Sending broadcast: {title} - {body}");
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Get valid device tokens where user has notifications enabled
            var tokens = await dbContext.UserDeviceTokens
                .Include(t => t.User)
                .Where(t => t.IsActive && t.User.NotificationsEnabled && !string.IsNullOrEmpty(t.DeviceToken))
                .Select(t => t.DeviceToken)
                .Distinct()
                .ToListAsync(stoppingToken);

            if (!tokens.Any())
            {
                _logger.LogInformation("No active device tokens found for broadcast.");
                return;
            }

            var payloads = new List<object>();
            foreach (var token in tokens)
            {
                payloads.Add(new
                {
                    to = token,
                    title = title,
                    body = body,
                    sound = "default"
                });
            }

            var json = JsonSerializer.Serialize(payloads);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://exp.host/--/api/v2/push/send", content, stoppingToken);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation($"Successfully sent broadcast to {tokens.Count} devices.");
            }
            else
            {
                var errorMsg = await response.Content.ReadAsStringAsync(stoppingToken);
                _logger.LogError($"Failed to send broadcast. Status Code: {response.StatusCode}. Error: {errorMsg}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while sending push notifications.");
        }
    }
}
