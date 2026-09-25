using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Hubs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DriverController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<RideTrackingHub> _hub;
    private readonly INotificationService? _notificationService;

    public DriverController(AppDbContext db, IHubContext<RideTrackingHub> hub, INotificationService? notificationService = null)
    {
        _db = db;
        _hub = hub;
        _notificationService = notificationService;
    }

    private async Task<Driver?> GetAuthorizedDriverAsync()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !long.TryParse(claim.Value, out var userId))
            return null;

        var isDriver = User.IsInRole(RoleNames.Driver);
        var isAdmin = User.IsInRole(RoleNames.Admin);

        if (!isDriver && !isAdmin)
            return null;

        var driver = await _db.Drivers
            .Include(d => d.Vehicles)
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.UserId == userId && d.IsActive);

        // If user has driver or admin role but no driver record exists yet, auto-provision
        if (driver == null && (isDriver || isAdmin))
        {
            var user = await _db.Users.FindAsync(userId);
            if (user != null)
            {
                driver = new Driver
                {
                    UserId = user.Id,
                    LicenseNumber = "DL-TEST-" + user.MobileNumber.Substring(Math.Max(0, user.MobileNumber.Length - 4)),
                    IsVerified = true,
                    IsOnline = true,
                    Rating = 4.85m,
                    TotalRides = 15,
                    IsActive = true,
                    CurrentLatitude = 28.6315m,
                    CurrentLongitude = 77.2167m,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Drivers.Add(driver);
                await _db.SaveChangesAsync();

                // Add default vehicle
                var vehicle = new Vehicle
                {
                    DriverId = driver.Id,
                    Type = VehicleTypes.Bike,
                    Make = "Hero",
                    Model = "Splendor Plus",
                    RegistrationNumber = "DL 04 AB " + new Random().Next(1000, 9999),
                    Color = "Black",
                    Year = 2024,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Vehicles.Add(vehicle);
                await _db.SaveChangesAsync();

                driver.Vehicles.Add(vehicle);
            }
        }

        return driver;
    }

    /// <summary>
    /// Get authenticated driver profile and assigned vehicle
    /// </summary>
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<DriverProfileDto>>> GetProfile()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var vehicle = driver.Vehicles.FirstOrDefault(v => v.IsActive);

        return Ok(ApiResponse<DriverProfileDto>.Ok(new DriverProfileDto
        {
            Id = driver.Id,
            UserId = driver.UserId,
            FullName = driver.User?.FullName ?? "Driver",
            MobileNumber = driver.User?.MobileNumber ?? string.Empty,
            LicenseNumber = driver.LicenseNumber,
            IsVerified = driver.IsVerified,
            IsOnline = driver.IsOnline,
            CurrentLatitude = driver.CurrentLatitude,
            CurrentLongitude = driver.CurrentLongitude,
            Rating = driver.Rating,
            TotalRides = driver.TotalRides,
            Vehicle = vehicle == null ? null : new VehicleDto
            {
                Id = vehicle.Id,
                Type = vehicle.Type,
                Make = vehicle.Make,
                Model = vehicle.Model,
                RegistrationNumber = vehicle.RegistrationNumber,
                Color = vehicle.Color,
                Year = vehicle.Year
            }
        }));
    }

    /// <summary>
    /// Toggle online / offline duty status
    /// </summary>
    [HttpPost("toggle-online")]
    public async Task<ActionResult<ApiResponse<bool>>> ToggleOnline([FromBody] ToggleOnlineRequest request)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        driver.IsOnline = request.IsOnline;
        driver.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(driver.IsOnline, driver.IsOnline ? "You are now ONLINE" : "You are now OFFLINE"));
    }

    /// <summary>
    /// Get available ride requests for online drivers
    /// </summary>
    [HttpGet("available-rides")]
    public async Task<ActionResult<ApiResponse<List<DriverRideSummaryDto>>>> GetAvailableRides()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        if (!driver.IsOnline)
            return Ok(ApiResponse<List<DriverRideSummaryDto>>.Ok(new List<DriverRideSummaryDto>(), "Go online to see available rides"));

        var rides = await _db.Rides
            .Include(r => r.User)
            .Where(r => (r.Status == RideStatus.Requested || r.Status == "SEARCHING") && (r.DriverId == null || r.DriverId == driver.Id))
            .OrderByDescending(r => r.CreatedAt)
            .Take(20)
            .Select(r => new DriverRideSummaryDto
            {
                Id = r.Id,
                RideNumber = r.RideNumber,
                PickupAddress = r.PickupAddress,
                DropoffAddress = r.DropoffAddress,
                Fare = r.EstimatedFare,
                Status = r.Status,
                CreatedAt = r.CreatedAt,
                CustomerName = r.User.FullName ?? "Passenger",
                CustomerPhone = r.User.MobileNumber,
                OtpCode = r.OtpCode
            })
            .ToListAsync();

        return Ok(ApiResponse<List<DriverRideSummaryDto>>.Ok(rides));
    }

    /// <summary>
    /// Get current active ride for this driver (ACCEPTED, ARRIVING, STARTED)
    /// </summary>
    [HttpGet("active-ride")]
    public async Task<ActionResult<ApiResponse<RideDto?>>> GetActiveRide()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var activeStatuses = new[] { RideStatus.Accepted, RideStatus.Arriving, RideStatus.Started };

        var ride = await _db.Rides
            .Include(r => r.User)
            .Include(r => r.Vehicle)
            .FirstOrDefaultAsync(r => r.DriverId == driver.Id && activeStatuses.Contains(r.Status));

        if (ride == null)
            return Ok(ApiResponse<RideDto?>.Ok(null, "No active ride"));

        var vehicle = ride.Vehicle ?? driver.Vehicles.FirstOrDefault(v => v.IsActive);

        var dto = new RideDto
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
            Driver = new DriverSummaryDto
            {
                Id = driver.Id,
                FullName = driver.User?.FullName ?? "Driver",
                Phone = driver.User?.MobileNumber ?? string.Empty,
                Rating = driver.Rating,
                TotalRides = driver.TotalRides,
                VehicleModel = vehicle != null ? $"{vehicle.Make} {vehicle.Model}" : "Vehicle",
                RegistrationNumber = vehicle?.RegistrationNumber ?? string.Empty,
                VehicleColor = vehicle?.Color ?? string.Empty,
                CurrentLatitude = driver.CurrentLatitude,
                CurrentLongitude = driver.CurrentLongitude
            }
        };

        return Ok(ApiResponse<RideDto?>.Ok(dto));
    }

    /// <summary>
    /// Accept a ride request
    /// </summary>
    [HttpPost("rides/{id:long}/accept")]
    public async Task<ActionResult<ApiResponse<RideDto>>> AcceptRide(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var ride = await _db.Rides.Include(r => r.User).FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse<RideDto>.Fail("Ride not found"));

        if (ride.DriverId != null && ride.DriverId != driver.Id)
        {
            return Conflict(ApiResponse<RideDto>.Fail("This ride has already been accepted by another driver."));
        }

        if (ride.Status != RideStatus.Requested && ride.Status != "SEARCHING" && ride.DriverId != driver.Id)
        {
            return Conflict(ApiResponse<RideDto>.Fail("This ride is no longer available for booking."));
        }

        var vehicle = driver.Vehicles.FirstOrDefault(v => v.IsActive);

        ride.DriverId = driver.Id;
        ride.VehicleId = vehicle?.Id;
        ride.Status = RideStatus.Accepted;
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var driverSummary = new DriverSummaryDto
        {
            Id = driver.Id,
            FullName = driver.User?.FullName ?? "Driver",
            Phone = driver.User?.MobileNumber ?? string.Empty,
            Rating = driver.Rating,
            TotalRides = driver.TotalRides,
            VehicleModel = vehicle != null ? $"{vehicle.Make} {vehicle.Model}" : "Vehicle",
            RegistrationNumber = vehicle?.RegistrationNumber ?? string.Empty,
            VehicleColor = vehicle?.Color ?? string.Empty,
            CurrentLatitude = driver.CurrentLatitude,
            CurrentLongitude = driver.CurrentLongitude
        };

        // Broadcast to customer through SignalR
        await _hub.Clients.Group($"ride-{ride.Id}").SendAsync("DriverAssigned", driverSummary);
        await _hub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            updatedAt = DateTime.UtcNow
        });

        // Broadcast to all drivers in drivers-pool so other screens remove this ride in real time
        await _hub.Clients.Group("drivers-pool").SendAsync("RideAcceptedByOther", new
        {
            rideId = ride.Id,
            driverId = driver.Id,
            status = ride.Status
        });

        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Driver Assigned! 🚖",
                $"{driverSummary.FullName} has accepted your ride {ride.RideNumber} and is heading to pickup.",
                "RIDE",
                ride.Id.ToString());
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
            Status = ride.Status,
            OtpCode = ride.OtpCode,
            PaymentMethod = ride.PaymentMethod,
            PaymentStatus = ride.PaymentStatus,
            CreatedAt = ride.CreatedAt,
            Driver = driverSummary
        }, "Ride accepted"));
    }

    /// <summary>
    /// Update ride status to ARRIVING at pickup location
    /// </summary>
    [HttpPost("rides/{id:long}/arriving")]
    public async Task<ActionResult<ApiResponse>> MarkArriving(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id && r.DriverId == driver.Id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found for this driver"));

        ride.Status = RideStatus.Arriving;
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            updatedAt = DateTime.UtcNow
        });

        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Driver Arrived! 📍",
                $"Your driver has arrived at the pickup location. Share OTP: {ride.OtpCode}",
                "RIDE",
                ride.Id.ToString());
        }

        return Ok(ApiResponse.Ok("Status updated to ARRIVING"));
    }

    /// <summary>
    /// Start ride with passenger OTP verification
    /// </summary>
    [HttpPost("rides/{id:long}/start")]
    public async Task<ActionResult<ApiResponse>> StartRide(long id, [FromBody] VerifyRideOtpRequest request)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found"));
        if (ride.DriverId != driver.Id)
            return Forbid();

        if (ride.OtpCode != request.OtpCode)
            return BadRequest(ApiResponse.Fail("Invalid ride OTP code"));

        ride.Status = RideStatus.Started;
        ride.StartedAt = DateTime.UtcNow;
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            updatedAt = DateTime.UtcNow
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
    /// Complete ride and finalize fare
    /// </summary>
    [HttpPost("rides/{id:long}/complete")]
    public async Task<ActionResult<ApiResponse>> CompleteRide(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id && r.DriverId == driver.Id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found for this driver"));

        ride.Status = RideStatus.Completed;
        ride.ActualFare = ride.EstimatedFare;
        ride.PaymentStatus = "COMPLETED";
        ride.CompletedAt = DateTime.UtcNow;
        ride.UpdatedAt = DateTime.UtcNow;

        driver.TotalRides += 1;
        driver.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            updatedAt = DateTime.UtcNow
        });

        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Ride Completed! 🎉",
                $"You have reached your destination. Final fare: ₹{ride.ActualFare}.",
                "RIDE",
                ride.Id.ToString());
        }
        if (_notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                driver.UserId,
                "Ride Completed! 💰",
                $"Ride {ride.RideNumber} completed. Fare ₹{ride.ActualFare} recorded.",
                "RIDE",
                ride.Id.ToString());
        }

        return Ok(ApiResponse.Ok("Ride completed successfully"));
    }

    /// <summary>
    /// Driver cancels ride with reason
    /// </summary>
    [HttpPost("rides/{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse>> CancelRide(long id, [FromBody] CancelRideRequest request)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == id && r.DriverId == driver.Id);
        if (ride == null)
            return NotFound(ApiResponse.Fail("Ride not found for this driver"));

        if (ride.Status == RideStatus.Started || ride.Status == RideStatus.Completed)
            return BadRequest(ApiResponse.Fail("Active started or completed rides cannot be cancelled"));

        ride.Status = RideStatus.Cancelled;
        ride.CancelledAt = DateTime.UtcNow;
        ride.CancellationReason = request.Reason ?? "Cancelled by driver";
        ride.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            reason = ride.CancellationReason,
            updatedAt = DateTime.UtcNow
        });

        if (ride.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                ride.UserId,
                "Ride Cancelled by Driver ❌",
                $"Your ride {ride.RideNumber} was cancelled by driver. Reason: {ride.CancellationReason}",
                "RIDE",
                ride.Id.ToString());
        }

        return Ok(ApiResponse.Ok("Ride cancelled"));
    }

    /// <summary>
    /// Update driver GPS telemetry and broadcast to active ride group
    /// </summary>
    [HttpPost("location")]
    public async Task<ActionResult<ApiResponse>> UpdateLocation([FromBody] UpdateDriverLocationRequest request)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        driver.CurrentLatitude = request.Latitude;
        driver.CurrentLongitude = request.Longitude;
        driver.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (request.RideId.HasValue)
        {
            await _hub.Clients.Group($"ride-{request.RideId.Value}").SendAsync("DriverLocationUpdated", new
            {
                rideId = request.RideId.Value,
                latitude = request.Latitude,
                longitude = request.Longitude,
                heading = request.Heading,
                speed = request.Speed,
                updatedAt = DateTime.UtcNow
            });
        }

        return Ok(ApiResponse.Ok("Location updated"));
    }

    /// <summary>
    /// Get ride history for this driver
    /// </summary>
    [HttpGet("history")]
    [HttpGet("rides/history")]
    public async Task<ActionResult<ApiResponse<List<DriverRideSummaryDto>>>> GetHistory()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var rides = await _db.Rides
            .Include(r => r.User)
            .Where(r => r.DriverId == driver.Id)
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .Select(r => new DriverRideSummaryDto
            {
                Id = r.Id,
                RideNumber = r.RideNumber,
                PickupAddress = r.PickupAddress,
                DropoffAddress = r.DropoffAddress,
                Fare = r.ActualFare ?? r.EstimatedFare,
                Status = r.Status,
                CreatedAt = r.CreatedAt,
                CustomerName = r.User.FullName ?? "Passenger",
                CustomerPhone = r.User.MobileNumber,
                OtpCode = r.OtpCode
            })
            .ToListAsync();

        return Ok(ApiResponse<List<DriverRideSummaryDto>>.Ok(rides));
    }

    /// <summary>
    /// Get driver earnings summary
    /// </summary>
    [HttpGet("earnings")]
    public async Task<ActionResult<ApiResponse<DriverEarningsDto>>> GetEarnings()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var today = DateTime.UtcNow.Date;
        var weekAgo = today.AddDays(-7);

        var completedRides = await _db.Rides
            .Include(r => r.User)
            .Where(r => r.DriverId == driver.Id && r.Status == RideStatus.Completed)
            .OrderByDescending(r => r.CompletedAt ?? r.CreatedAt)
            .ToListAsync();

        var todayRides = completedRides.Where(r => (r.CompletedAt ?? r.CreatedAt) >= today).ToList();
        var weekRides = completedRides.Where(r => (r.CompletedAt ?? r.CreatedAt) >= weekAgo).ToList();

        var recent = completedRides.Take(10).Select(r => new DriverRideSummaryDto
        {
            Id = r.Id,
            RideNumber = r.RideNumber,
            PickupAddress = r.PickupAddress,
            DropoffAddress = r.DropoffAddress,
            Fare = r.ActualFare ?? r.EstimatedFare,
            Status = r.Status,
            CreatedAt = r.CreatedAt,
            CustomerName = r.User?.FullName ?? "Passenger",
            CustomerPhone = r.User?.MobileNumber ?? string.Empty
        }).ToList();

        return Ok(ApiResponse<DriverEarningsDto>.Ok(new DriverEarningsDto
        {
            TodayEarnings = todayRides.Sum(r => r.ActualFare ?? r.EstimatedFare),
            TodayRides = todayRides.Count,
            WeeklyEarnings = weekRides.Sum(r => r.ActualFare ?? r.EstimatedFare),
            WeeklyRides = weekRides.Count,
            TotalEarnings = completedRides.Sum(r => r.ActualFare ?? r.EstimatedFare),
            TotalRides = driver.TotalRides,
            RecentTrips = recent
        }));
    }
}
