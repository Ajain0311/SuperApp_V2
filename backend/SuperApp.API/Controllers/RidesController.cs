using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RidesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<RideTrackingHub> _rideHub;

    public RidesController(AppDbContext db, IHubContext<RideTrackingHub> rideHub)
    {
        _db = db;
        _rideHub = rideHub;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1; // Default dev user
    }

    /// <summary>
    /// Get list of past and active rides for the current authenticated user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RideDto>>>> GetMyRides()
    {
        var userId = GetCurrentUserId();
        var rides = await _db.Rides
            .Where(r => r.UserId == userId)
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
    [HttpPost("estimate")]
    public ActionResult<ApiResponse<RideEstimateResponse>> GetEstimate([FromBody] RideEstimateRequest request)
    {
        // Calculate mock distance based on coordinates (Haversine approximation or fixed 16.4 km default)
        decimal distanceKm = 16.4m;
        int estimatedMinutes = 34;

        var bikeFare = Math.Round(20.0m + (distanceKm * 1.5m), 0); // ~₹45
        var autoFare = Math.Round(25.0m + (distanceKm * 2.5m), 0); // ~₹65
        var cabFare = Math.Round(45.0m + (distanceKm * 5.0m), 0);  // ~₹125

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
        var random = new Random();

        // Generate 4-digit ride OTP
        var rideOtp = random.Next(1000, 9999).ToString();
        var rideNumber = $"RD-{random.Next(1000, 9999)}";

        // Calculate fare
        decimal estimatedFare = request.VehicleType.ToUpper() switch
        {
            VehicleTypes.Auto => 65.00m,
            VehicleTypes.Cab => 125.00m,
            _ => 45.00m
        };

        var ride = new Ride
        {
            RideNumber = rideNumber,
            UserId = userId,
            VehicleType = request.VehicleType.ToUpper(),
            PickupAddress = request.PickupAddress,
            PickupLatitude = request.PickupLatitude,
            PickupLongitude = request.PickupLongitude,
            DropoffAddress = request.DropoffAddress,
            DropoffLatitude = request.DropoffLatitude,
            DropoffLongitude = request.DropoffLongitude,
            DistanceKm = 16.4m,
            EstimatedFare = estimatedFare,
            Status = RideStatus.Requested, // Set to REQUESTED for driver dispatch
            OtpCode = rideOtp,
            PaymentMethod = request.PaymentMethod,
            PaymentStatus = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _db.Rides.Add(ride);
        await _db.SaveChangesAsync();

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
        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse<RideDto>.Fail("Ride not found"));

        var driverSummary = new DriverSummaryDto
        {
            Id = 1,
            FullName = "Amit Singh",
            Phone = "+91 98765 01928",
            Rating = 4.9m,
            TotalRides = 1240,
            VehicleModel = "Hero Splendor Plus (Black)",
            RegistrationNumber = "DL 04 AB 9821",
            VehicleColor = "Black",
            CurrentLatitude = ride.PickupLatitude + 0.001m,
            CurrentLongitude = ride.PickupLongitude + 0.001m
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
        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));

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

        return Ok(ApiResponse.Ok("Ride started successfully"));
    }

    /// <summary>
    /// Complete ride and record final fare
    /// </summary>
    [HttpPost("{id:long}/complete")]
    public async Task<ActionResult<ApiResponse>> CompleteRide(long id)
    {
        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));

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

        return Ok(ApiResponse.Ok("Ride completed successfully"));
    }

    /// <summary>
    /// Cancel ride with optional reason
    /// </summary>
    [HttpPost("{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse>> CancelRide(long id, [FromBody] CancelRideRequest? request)
    {
        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));

        if (ride.Status == RideStatus.Started || ride.Status == RideStatus.Completed)
            return BadRequest(ApiResponse.Fail("Active or completed rides cannot be cancelled"));

        var previousStatus = ride.Status;
        ride.Status = RideStatus.Cancelled;
        ride.CancelledAt = DateTime.UtcNow;
        ride.CancellationReason = request?.Reason ?? "Cancelled by user";
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

        return Ok(ApiResponse.Ok("Ride cancelled successfully"));
    }
}
