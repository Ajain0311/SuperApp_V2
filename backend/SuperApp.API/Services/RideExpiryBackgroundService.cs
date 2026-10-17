using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using SuperApp.API.Data;
using SuperApp.API.Hubs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Background service that periodically sweeps and expires any ride requests that remain unaccepted after 5 minutes.
/// </summary>
public class RideExpiryBackgroundService : BackgroundService
{
    private readonly ILogger<RideExpiryBackgroundService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(15);

    public RideExpiryBackgroundService(ILogger<RideExpiryBackgroundService> logger, IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[RideExpiry] RideExpiryBackgroundService started. Sweeping unaccepted rides every {Seconds}s.", Interval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepExpiredRidesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RideExpiry] Error while sweeping expired rides.");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("[RideExpiry] RideExpiryBackgroundService stopped.");
    }

    public async Task<int> SweepExpiredRidesAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<RideTrackingHub>>();
        var notifService = scope.ServiceProvider.GetService<INotificationService>();

        var cutoff = DateTime.UtcNow.AddMinutes(-5);

        // Fetch rides that have been in REQUESTED or SEARCHING state with no driver for > 5 minutes
        var expiredRides = await db.Rides
            .Where(r => (r.Status == RideStatus.Requested || r.Status == RideStatus.Searching) 
                     && r.DriverId == null 
                     && r.CreatedAt < cutoff)
            .Take(100)
            .ToListAsync(cancellationToken);

        if (!expiredRides.Any())
            return 0;

        _logger.LogInformation("[RideExpiry] Found {Count} rides exceeding 5-minute request window. Expiring...", expiredRides.Count);

        var now = DateTime.UtcNow;
        int count = 0;

        foreach (var ride in expiredRides)
        {
            ride.Status = RideStatus.Expired;
            ride.UpdatedAt = now;
            count++;

            // Broadcast to customer tracking screen
            await hub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
            {
                rideId = ride.Id,
                status = RideStatus.Expired,
                reason = "No driver accepted within 5 minutes.",
                updatedAt = now
            }, cancellationToken);

            // Broadcast to drivers pool so any open cards/modals are removed
            await hub.Clients.Group("drivers-pool").SendAsync("RideExpired", new
            {
                rideId = ride.Id,
                status = RideStatus.Expired
            }, cancellationToken);

            // Optional push to customer
            if (ride.UserId > 0 && notifService != null)
            {
                try
                {
                    await notifService.SendPushNotificationAsync(
                        ride.UserId,
                        "Ride Request Expired ⏱️",
                        "No captains were able to accept your ride within 5 minutes. Please try searching again.",
                        "RIDE",
                        ride.Id.ToString());
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[RideExpiry] Could not send expiry push to customer #{UserId}", ride.UserId);
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("[RideExpiry] Successfully transitioned {Count} rides to EXPIRED status.", count);
        return count;
    }
}
