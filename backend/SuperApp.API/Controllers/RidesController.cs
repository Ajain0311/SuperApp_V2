using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Hubs;
using SuperApp.API.Services;
using Microsoft.AspNetCore.SignalR;

namespace SuperApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class RidesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<RideTrackingHub> _rideHub;
    private readonly IMapService _mapService;
    private readonly INotificationService? _notificationService;

    public RidesController(
        AppDbContext db,
        IHubContext<RideTrackingHub> rideHub,
        IMapService mapService,
        INotificationService? notificationService = null)
    {
        _db = db;
        _rideHub = rideHub;
        _mapService = mapService;
        _notificationService = notificationService;
    }

    private long? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    /// <summary>
    /// Get list of past and active rides for the current authenticated user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RideDto>>>> GetMyRides()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<List<RideDto>>.Fail("Authentication required"));

        var rides = await _db.Rides
            .Where(r => r.UserId == userId.Value)
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .ToListAsync();

        var dtos = rides.Select(r => new RideDto
        {
            Id = r.Id,
            RideNumber = r.RideNumber,
            VehicleType = r.VehicleType,
            PickupAddress = r.PickupAddress,
            DropoffAddress = r.DropoffAddress,
            DistanceKm = r.DistanceKm,
            EstimatedFare = r.EstimatedFare,
            ActualFare = r.ActualFare,
            Status = r.Status,
            OtpCode = r.OtpCode,
            PaymentMethod = r.PaymentMethod,
            PaymentStatus = r.PaymentStatus,
            CreatedAt = r.CreatedAt
        }).ToList();

        return Ok(ApiResponse<List<RideDto>>.Ok(dtos));
    }

    /// <summary>
    /// Calculate distance, ETA, and fare estimate across vehicle tiers (BIKE, AUTO, CAB)
    /// </summary>
    [AllowAnonymous]
    [HttpPost("estimate")]
    public async Task<ActionResult<ApiResponse<RideEstimateResponse>>> GetEstimate([FromBody] RideEstimateRequest request)
    {
        var route = await _mapService.EstimateRouteAsync(
            request.PickupLatitude,
            request.PickupLongitude,
            request.DropoffLatitude,
            request.DropoffLongitude);

        var distanceKm = (decimal)route.DistanceKm;
        var estimatedMinutes = route.EstimatedDurationMinutes;

        var bikeFare = Math.Round(20.0m + (distanceKm * 1.5m), 0);
        var autoFare = Math.Round(25.0m + (distanceKm * 2.5m), 0);
        var cabFare = Math.Round(45.0m + (distanceKm * 5.0m), 0);

        var options = new List<VehicleEstimateDto>
        {
            new()
            {
                VehicleType = VehicleTypes.Bike,
                Title = "Bike Taxi",
                Tag = "FASTEST",
                Subtitle = "Beat traffic • Helmet provided • 3m away",
                EstimatedFare = bikeFare,
                EtaMinutes = 3,
                IconName = "two_wheeler"
            },
            new()
            {
                VehicleType = VehicleTypes.Auto,
                Title = "Auto Rickshaw",
                Tag = "VALUE",
                Subtitle = "Direct drop • Max 3 seats • 5m away",
                EstimatedFare = autoFare,
                EtaMinutes = 5,
                IconName = "electric_rickshaw"
            },
            new()
            {
                VehicleType = VehicleTypes.Cab,
                Title = "Economy Cab",
                Tag = "COMFORT",
                Subtitle = "AC Hatchback • Luggage space • 7m away",
                EstimatedFare = cabFare,
                EtaMinutes = 7,
                IconName = "directions_car"
            }
        };

        return Ok(ApiResponse<RideEstimateResponse>.Ok(new RideEstimateResponse
        {
            DistanceKm = distanceKm,
            EstimatedMinutes = estimatedMinutes,
            TrafficCondition = "Moderate Traffic",
            VehicleOptions = options
        }));
    }

    /// <summary>
    /// Book a ride, assign nearest driver, and generate passenger verification OTP
    /// </summary>
    [HttpPost("book")]
    public async Task<ActionResult<ApiResponse<RideDto>>> BookRide([FromBody] BookRideRequest request)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<RideDto>.Fail("Authentication required"));

        var random = new Random();

        // Generate 4-digit ride OTP
        var rideOtp = random.Next(1000, 9999).ToString();
        var rideNumber = $"RD-{random.Next(1000, 9999)}";

        var route = await _mapService.EstimateRouteAsync(
            request.PickupLatitude,
            request.PickupLongitude,
            request.DropoffLatitude,
            request.DropoffLongitude);
        var distanceKm = (decimal)route.DistanceKm;

        decimal estimatedFare = request.VehicleType.ToUpper() switch
        {
            VehicleTypes.Auto => Math.Round(25.0m + (distanceKm * 2.5m), 0),
            VehicleTypes.Cab => Math.Round(45.0m + (distanceKm * 5.0m), 0),
            _ => Math.Round(20.0m + (distanceKm * 1.5m), 0)
        };

        var ride = new Ride
        {
            RideNumber = rideNumber,
            UserId = userId.Value,
            VehicleType = request.VehicleType.ToUpper(),
            PickupAddress = request.PickupAddress,
            PickupLatitude = request.PickupLatitude,
            PickupLongitude = request.PickupLongitude,
            DropoffAddress = request.DropoffAddress,
            DropoffLatitude = request.DropoffLatitude,
            DropoffLongitude = request.DropoffLongitude,
            DistanceKm = distanceKm,
            EstimatedFare = estimatedFare,
            Status = RideStatus.Requested, // Set to REQUESTED for driver dispatch
            OtpCode = rideOtp,
            PaymentMethod = request.PaymentMethod,
            PaymentStatus = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _db.Rides.Add(ride);
        await _db.SaveChangesAsync();

        if (_notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                userId.Value,
                "Ride Requested 🚖",
                $"Your {ride.VehicleType} ride {ride.RideNumber} has been requested. Looking for nearby drivers...",
                "RIDE",
                ride.Id.ToString());
        }

        // Broadcast to all drivers in drivers-pool
        await _rideHub.Clients.Group("drivers-pool").SendAsync("RideRequested", new
        {
            id = ride.Id,
            rideNumber = ride.RideNumber,
            pickupAddress = ride.PickupAddress,
            dropoffAddress = ride.DropoffAddress,
            fare = ride.EstimatedFare,
            status = ride.Status,
            createdAt = ride.CreatedAt
        });

        var driverSummary = new DriverSummaryDto
        {
            Id = 1,
            FullName = "Driver Pool",
            Phone = string.Empty,
            Rating = 4.9m,
            TotalRides = 120,
            VehicleModel = "Pending Driver Dispatch",
            RegistrationNumber = "SEARCHING",
            VehicleColor = "Standard",
            CurrentLatitude = request.PickupLatitude,
            CurrentLongitude = request.PickupLongitude
        };

        return Ok(ApiResponse<RideDto>.Ok(new RideDto
        {
            Id = ride.Id,
            RideNumber = ride.RideNumber,
            VehicleType = ride.VehicleType,
            PickupAddress = ride.PickupAddress,
            DropoffAddress = ride.DropoffAddress,
            DistanceKm = ride.DistanceKm,
            EstimatedFare = ride.EstimatedFare,
            Status = ride.Status,
            OtpCode = ride.OtpCode,
            PaymentMethod = ride.PaymentMethod,
            PaymentStatus = ride.PaymentStatus,
            CreatedAt = ride.CreatedAt,
            Driver = driverSummary
        }));
    }

    /// <summary>
    /// Get single ride details
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<RideDto>>> GetRide(long id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<RideDto>.Fail("Authentication required"));

        var ride = await _db.Rides
            .Include(r => r.Driver)
                .ThenInclude(d => d!.User)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse<RideDto>.Fail("Ride not found"));

        var isRider = ride.UserId == userId.Value;
        var isAssignedDriver = ride.Driver != null && ride.Driver.UserId == userId.Value;
        var isAdmin = User.IsInRole(RoleNames.Admin);

        if (!isRider && !isAssignedDriver && !isAdmin)
        {
            return Forbid();
        }

        DriverSummaryDto? driverSummary = null;
        if (ride.Driver != null)
        {
            var vehicle = await _db.Vehicles.FirstOrDefaultAsync(v => v.DriverId == ride.Driver.Id && v.IsActive);
            driverSummary = new DriverSummaryDto
            {
                Id = ride.Driver.Id,
                FullName = ride.Driver.User?.FullName ?? "Driver",
                Phone = ride.Driver.User?.MobileNumber ?? string.Empty,
                Rating = ride.Driver.Rating,
                TotalRides = ride.Driver.TotalRides,
                VehicleModel = vehicle != null ? $"{vehicle.Make} {vehicle.Model}" : "Vehicle",
                RegistrationNumber = vehicle?.RegistrationNumber ?? string.Empty,
                VehicleColor = vehicle?.Color ?? string.Empty,
                CurrentLatitude = ride.Driver.CurrentLatitude,
                CurrentLongitude = ride.Driver.CurrentLongitude
            };
        }

        return Ok(ApiResponse<RideDto>.Ok(new RideDto
        {
            Id = ride.Id,
            RideNumber = ride.RideNumber,
            VehicleType = ride.VehicleType,
            PickupAddress = ride.PickupAddress,
            DropoffAddress = ride.DropoffAddress,
            DistanceKm = ride.DistanceKm,
            EstimatedFare = ride.EstimatedFare,
            ActualFare = ride.ActualFare,
            Status = ride.Status,
            OtpCode = ride.OtpCode,
            PaymentMethod = ride.PaymentMethod,
            PaymentStatus = ride.PaymentStatus,
            CreatedAt = ride.CreatedAt,
            Driver = driverSummary
        }));
    }

    /// <summary>
    /// Start ride with passenger OTP verification
    /// </summary>
    [HttpPost("{id:long}/start")]
    public async Task<ActionResult<ApiResponse>> StartRide(long id, [FromBody] VerifyRideOtpRequest request)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var ride = await _db.Rides.Include(r => r.Driver).FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));

        var isDriver = ride.Driver != null && ride.Driver.UserId == userId.Value;
        var isAdmin = User.IsInRole(RoleNames.Admin);
        if (!isDriver && !isAdmin)
            return Forbid();

        if (ride.OtpCode != request.OtpCode)
            return BadRequest(ApiResponse.Fail("Invalid ride OTP code"));

        ride.Status = RideStatus.Started;
        ride.StartedAt = DateTime.UtcNow;
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _rideHub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            startedAt = ride.StartedAt
        });

        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Ride Started! 🚗💨",
                $"Your ride {ride.RideNumber} has started. Have a safe journey!",
                "RIDE",
                ride.Id.ToString());
        }

        return Ok(ApiResponse.Ok("Ride started successfully"));
    }

    /// <summary>
    /// Complete ride and record final fare
    /// </summary>
    [HttpPost("{id:long}/complete")]
    public async Task<ActionResult<ApiResponse>> CompleteRide(long id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var ride = await _db.Rides.Include(r => r.Driver).FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));

        var isDriver = ride.Driver != null && ride.Driver.UserId == userId.Value;
        var isAdmin = User.IsInRole(RoleNames.Admin);
        if (!isDriver && !isAdmin)
            return Forbid();

        ride.Status = RideStatus.Completed;
        ride.ActualFare = ride.EstimatedFare;
        ride.PaymentStatus = "COMPLETED";
        ride.CompletedAt = DateTime.UtcNow;
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _rideHub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            actualFare = ride.ActualFare,
            completedAt = ride.CompletedAt
        });

        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Ride Completed! 🎉",
                $"You have arrived at your destination. Final fare: ₹{ride.ActualFare}.",
                "RIDE",
                ride.Id.ToString());
        }
        if (ride.Driver != null && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.Driver.UserId,
                "Ride Completed! 💰",
                $"Ride {ride.RideNumber} completed. Fare ₹{ride.ActualFare} recorded.",
                "RIDE",
                ride.Id.ToString());
        }

        return Ok(ApiResponse.Ok("Ride completed successfully"));
    }

    /// <summary>
    /// Cancel ride with optional reason
    /// </summary>
    [HttpPost("{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse>> CancelRide(long id, [FromBody] CancelRideRequest? request)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var ride = await _db.Rides.Include(r => r.Driver).FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));

        var isRider = ride.UserId == userId.Value;
        var isDriver = ride.Driver != null && ride.Driver.UserId == userId.Value;
        var isAdmin = User.IsInRole(RoleNames.Admin);
        if (!isRider && !isDriver && !isAdmin)
            return Forbid();

        if (ride.Status == RideStatus.Started || ride.Status == RideStatus.Completed)
            return BadRequest(ApiResponse.Fail("Active or completed rides cannot be cancelled"));

        var previousStatus = ride.Status;
        ride.Status = RideStatus.Cancelled;
        ride.CancelledAt = DateTime.UtcNow;
        ride.CancellationReason = request?.Reason ?? (isRider ? "Cancelled by passenger" : "Cancelled by driver");
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _rideHub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            reason = ride.CancellationReason,
            cancelledAt = ride.CancelledAt
        });

        if (previousStatus == RideStatus.Requested)
        {
            await _rideHub.Clients.Group("drivers-pool").SendAsync("RideCancelled", new
            {
                rideId = ride.Id,
                status = ride.Status
            });
        }

        // Send notifications
        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Ride Cancelled ❌",
                $"Ride {ride.RideNumber} was cancelled. Reason: {ride.CancellationReason}",
                "RIDE",
                ride.Id.ToString());
        }
        if (ride.Driver != null && isRider && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.Driver.UserId,
                "Ride Cancelled by Rider ❌",
                $"Passenger cancelled ride {ride.RideNumber}.",
                "RIDE",
                ride.Id.ToString());
        }

        return Ok(ApiResponse.Ok("Ride cancelled successfully"));
    }
}
