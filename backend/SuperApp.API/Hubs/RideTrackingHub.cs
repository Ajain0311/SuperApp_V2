using Microsoft.AspNetCore.SignalR;

namespace SuperApp.API.Hubs;

public class RideTrackingHub : Hub
{
    public async Task JoinRide(long rideId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"ride-{rideId}");
    }

    public async Task LeaveRide(long rideId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"ride-{rideId}");
    }

    public async Task UpdateDriverLocation(long rideId, decimal latitude, decimal longitude, double? heading, double? speed)
    {
        await Clients.Group($"ride-{rideId}").SendAsync("DriverLocationUpdated", new
        {
            rideId,
            latitude,
            longitude,
            heading,
            speed,
            updatedAt = DateTime.UtcNow
        });
    }

    public async Task UpdateRideStatus(long rideId, string status)
    {
        await Clients.Group($"ride-{rideId}").SendAsync("RideStatusChanged", new
        {
            rideId,
            status,
            updatedAt = DateTime.UtcNow
        });
    }
}
