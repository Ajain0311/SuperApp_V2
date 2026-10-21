using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Hubs;

[Authorize]
public class RideTrackingHub : Hub
{
    private readonly AppDbContext _db;

    public RideTrackingHub(AppDbContext db)
    {
        _db = db;
    }

    private long? GetUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    public async Task JoinRide(long rideId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required to join ride");
        }

        // Validate ride authorization: caller must be the passenger, the assigned driver, or an Admin
        var isAuthorized = await _db.Rides
            .Include(r => r.Driver)
            .AnyAsync(r => r.Id == rideId && (
                r.UserId == userId.Value ||
                (r.Driver != null && r.Driver.UserId == userId.Value)
            ));

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;

        if (!isAuthorized && !isAdmin)
        {
            throw new HubException("Unauthorized to join this ride's tracking channel");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"ride-{rideId}");
    }

    public async Task LeaveRide(long rideId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"ride-{rideId}");
    }

    public async Task JoinDriversPool()
    {
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required to join drivers pool");
        }

        var isDriver = Context.User?.IsInRole(RoleNames.Driver) ?? false;
        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;

        if (!isDriver && !isAdmin)
        {
            throw new HubException("Unauthorized: Only registered captains can join the drivers pool");
        }

        if (!isAdmin)
        {
            var isVerifiedActiveDriver = await _db.Drivers
                .AnyAsync(d => d.UserId == userId.Value && d.IsActive && d.IsVerified);

            if (!isVerifiedActiveDriver)
            {
                throw new HubException("Unauthorized: Driver record must be active and verified by admin to join drivers pool");
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, "drivers-pool");
    }

    public async Task LeaveDriversPool()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "drivers-pool");
    }

    public async Task UpdateDriverLocation(long rideId, decimal latitude, decimal longitude, double? heading, double? speed)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required");
        }

        // Validate driver ownership of the active ride
        var ride = await _db.Rides
            .Include(r => r.Driver)
            .FirstOrDefaultAsync(r => r.Id == rideId);

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;

        if (ride == null || (ride.Driver?.UserId != userId.Value && !isAdmin))
        {
            throw new HubException("Unauthorized: Only the assigned captain can broadcast location for this ride");
        }

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
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required");
        }

        var ride = await _db.Rides
            .Include(r => r.Driver)
            .FirstOrDefaultAsync(r => r.Id == rideId);

        if (ride == null)
        {
            throw new HubException("Ride not found");
        }

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;
        var isPassenger = ride.UserId == userId.Value;
        var isAssignedDriver = ride.Driver != null && ride.Driver.UserId == userId.Value;

        if (!isAdmin && !isPassenger && !isAssignedDriver)
        {
            throw new HubException("Unauthorized: Only authorized participants or admins can modify ride tracking status");
        }

        var normalized = (status ?? "").Trim().ToUpperInvariant();
        if (normalized != RideStatus.Requested &&
            normalized != RideStatus.Searching &&
            normalized != RideStatus.Assigned &&
            normalized != RideStatus.Accepted &&
            normalized != RideStatus.Arriving &&
            normalized != RideStatus.Started &&
            normalized != RideStatus.Completed &&
            normalized != RideStatus.Cancelled &&
            normalized != RideStatus.Expired)
        {
            throw new HubException($"Invalid ride status '{status}'. Only authoritative RideStatus values are permitted.");
        }

        // Only allow broadcast if status matches the authoritative persisted ride status in DB
        // or caller is Admin executing an authorized administrative state sync
        if (!isAdmin && !string.Equals(ride.Status, normalized, StringComparison.OrdinalIgnoreCase))
        {
            throw new HubException($"State transition mismatch. Ride status is server-owned (current DB status: '{ride.Status}'). Use dedicated REST endpoints to transition ride states.");
        }

        await Clients.Group($"ride-{rideId}").SendAsync("RideStatusChanged", new
        {
            rideId,
            status = ride.Status,
            updatedAt = DateTime.UtcNow
        });
    }
}

