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
    private readonly IHubContext<OrderStatusHub>? _orderHub;
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<long, SemaphoreSlim> FoodAcceptLocks = new();

    public DriverController(
        AppDbContext db,
        IHubContext<RideTrackingHub> hub,
        INotificationService? notificationService = null,
        IHubContext<OrderStatusHub>? orderHub = null)
    {
        _db = db;
        _hub = hub;
        _notificationService = notificationService;
        _orderHub = orderHub;
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

        if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            if (ride.DriverId != null || (ride.Status != RideStatus.Requested && ride.Status != RideStatus.Searching))
            {
                return Conflict(ApiResponse<RideDto>.Fail("This ride has already been accepted by another driver."));
            }
            ride.DriverId = driver.Id;
            ride.VehicleId = vehicle?.Id;
            ride.Status = RideStatus.Accepted;
            ride.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        else
        {
            var claimed = await _db.Rides
                .Where(r => r.Id == ride.Id && r.DriverId == null && (r.Status == RideStatus.Requested || r.Status == RideStatus.Searching))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(r => r.DriverId, driver.Id)
                    .SetProperty(r => r.Status, RideStatus.Accepted)
                    .SetProperty(r => r.UpdatedAt, DateTime.UtcNow));
            if (claimed == 0)
                return Conflict(ApiResponse<RideDto>.Fail("This ride has already been accepted by another driver."));

            ride.DriverId = driver.Id;
            _db.Entry(ride).Property(r => r.DriverId).IsModified = false;
            _db.Entry(ride).Property(r => r.Status).IsModified = false;
            ride.VehicleId = vehicle?.Id;
            ride.Status = RideStatus.Accepted;
            ride.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

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

        RideCompletion.MarkCompleted(ride);

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

        // Do not delete or permanently cancel the ride. Unassign driver so others can pick it up.
        ride.DriverId = null;
        ride.Status = RideStatus.Searching;
        ride.UpdatedAt = DateTime.UtcNow;
        ride.CancellationReason = request.Reason; // Audit trail of last unassign reason
        await _db.SaveChangesAsync();

        // Notify rider
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
                "Driver Unassigned 🔄",
                "Your driver had to cancel. We are searching for another driver.",
                "RIDE",
                ride.Id.ToString());
        }

        // Return to driver pool
        await _hub.Clients.Group("drivers-pool").SendAsync("RideRequested", new
        {
            id = ride.Id,
            rideNumber = ride.RideNumber,
            pickupAddress = ride.PickupAddress,
            dropoffAddress = ride.DropoffAddress,
            fare = ride.EstimatedFare,
            status = ride.Status,
            createdAt = ride.CreatedAt
        });

        return Ok(ApiResponse.Ok("Ride unassigned and returned to pool"));
    }

    /// <summary>
    /// Driver unassigns from an accepted food order
    /// </summary>
    [HttpPost("food-orders/{id:long}/unassign")]
    public async Task<ActionResult<ApiResponse>> UnassignFoodOrder(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var order = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id && o.DriverId == driver.Id);
        if (order == null)
            return NotFound(ApiResponse.Fail("Food order not found for this driver"));

        if (order.Status == OrderStatus.PickedUp || order.Status == OrderStatus.Delivered)
            return BadRequest(ApiResponse.Fail("Picked up or delivered orders cannot be unassigned"));

        order.DriverId = null;
        order.DriverAssignedAt = null;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var payload = new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            status = order.Status, // Keeps its current state, likely Ready
            updatedAt = DateTime.UtcNow
        };
        await _hub.Clients.Group("drivers-pool").SendAsync("FoodDeliveryAccepted", payload);

        return Ok(ApiResponse.Ok("Food order unassigned and returned to pool"));
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

    /// <summary>READY food orders with no captain, visible only while this captain is online.</summary>
    [HttpGet("available-food-orders")]
    public async Task<ActionResult<ApiResponse<List<FoodOrderDto>>>> GetAvailableFoodOrders()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();
        if (!driver.IsOnline)
            return Ok(ApiResponse<List<FoodOrderDto>>.Ok(new List<FoodOrderDto>(), "Go online to see food deliveries"));

        var orders = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Address)
            .Include(o => o.Items)
            .Where(o => o.Status == OrderStatus.Ready && o.DriverId == null)
            .OrderBy(o => o.CreatedAt)
            .Take(30)
            .ToListAsync();

        return Ok(ApiResponse<List<FoodOrderDto>>.Ok(orders.Select(o => MapFood(o)).ToList()));
    }

    [HttpGet("active-food-order")]
    public async Task<ActionResult<ApiResponse<FoodOrderDto?>>> GetActiveFoodOrder()
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var order = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Address)
            .Include(o => o.Items)
            .Include(o => o.User)
            .Include(o => o.Driver).ThenInclude(d => d!.User)
            .Where(o => o.DriverId == driver.Id && (o.Status == OrderStatus.Ready || o.Status == OrderStatus.PickedUp))
            .OrderByDescending(o => o.UpdatedAt)
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<FoodOrderDto?>.Ok(order == null ? null : MapFood(order, order.User)));
    }

    /// <summary>One captain wins. The conditional update requires READY and a null driver.</summary>
    [HttpPost("food-orders/{id:long}/accept")]
    public async Task<ActionResult<ApiResponse<FoodOrderDto>>> AcceptFoodOrder(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();
        if (!driver.IsOnline)
            return Conflict(ApiResponse<FoodOrderDto>.Fail("Go online before accepting a food delivery"));

        var busy = await _db.FoodOrders.AnyAsync(o =>
            o.DriverId == driver.Id && o.Id != id &&
            (o.Status == OrderStatus.Ready || o.Status == OrderStatus.PickedUp));
        if (busy)
            return Conflict(ApiResponse<FoodOrderDto>.Fail("Finish the current food delivery before accepting another"));

        var order = await _db.FoodOrders.Include(o => o.Restaurant).Include(o => o.User).FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Food order not found"));

        var now = DateTime.UtcNow;
        var gate = FoodAcceptLocks.GetOrAdd(id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync();
        int claimed;
        try
        {
            if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
            {
                var current = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id);
                if (current == null || current.Status != OrderStatus.Ready || current.DriverId != null)
                {
                    claimed = 0;
                }
                else
                {
                    current.DriverId = driver.Id;
                    current.DriverAssignedAt = now;
                    current.UpdatedAt = now;
                    await _db.SaveChangesAsync();
                    claimed = 1;
                }
            }
            else
            {
                claimed = await _db.FoodOrders
                    .Where(o => o.Id == id && o.Status == OrderStatus.Ready && o.DriverId == null)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(o => o.DriverId, driver.Id)
                        .SetProperty(o => o.DriverAssignedAt, now)
                        .SetProperty(o => o.UpdatedAt, now));
            }
        }
        finally
        {
            gate.Release();
        }

        if (claimed == 0)
            return Conflict(ApiResponse<FoodOrderDto>.Fail("This delivery was already accepted by another captain"));

        order.DriverId = driver.Id;
        order.DriverAssignedAt = now;
        order.Status = OrderStatus.Ready;
        _db.Entry(order).Property(o => o.DriverId).IsModified = false;
        _db.Entry(order).Property(o => o.DriverAssignedAt).IsModified = false;

        await PublishFoodAssignment(order, driver, "CAPTAIN_ASSIGNED");
        var fresh = await _db.FoodOrders.Include(o => o.Restaurant).Include(o => o.Address).Include(o => o.Items)
            .Include(o => o.Driver).ThenInclude(d => d!.User).Include(o => o.User)
            .FirstAsync(o => o.Id == id);
        return Ok(ApiResponse<FoodOrderDto>.Ok(MapFood(fresh, fresh.User), "Food delivery accepted"));
    }

    [HttpPost("food-orders/{id:long}/pickup")]
    public async Task<ActionResult<ApiResponse>> PickupFoodOrder(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        int moved;
        if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            var current = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id && o.DriverId == driver.Id && o.Status == OrderStatus.Ready);
            if (current == null) moved = 0;
            else
            {
                current.Status = OrderStatus.PickedUp;
                current.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                moved = 1;
            }
        }
        else
        {
            moved = await _db.FoodOrders
                .Where(o => o.Id == id && o.DriverId == driver.Id && o.Status == OrderStatus.Ready)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Status, OrderStatus.PickedUp)
                    .SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
        }
        if (moved == 0)
        {
            var exists = await _db.FoodOrders.AnyAsync(o => o.Id == id);
            if (!exists) return NotFound(ApiResponse.Fail("Food order not found"));
            var mine = await _db.FoodOrders.AnyAsync(o => o.Id == id && o.DriverId == driver.Id);
            return mine
                ? BadRequest(ApiResponse.Fail("This delivery cannot be picked up in its current status"))
                : Forbid();
        }

        await PublishFoodStatus(id, OrderStatus.PickedUp, driver);
        return Ok(ApiResponse.Ok("Order picked up"));
    }

    [HttpPost("food-orders/{id:long}/deliver")]
    public async Task<ActionResult<ApiResponse>> DeliverFoodOrder(long id)
    {
        var driver = await GetAuthorizedDriverAsync();
        if (driver == null)
            return Forbid();

        var order = await _db.FoodOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
            return NotFound(ApiResponse.Fail("Food order not found"));
        if (order.DriverId != driver.Id)
            return Forbid();

        int moved;
        if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            var current = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id && o.DriverId == driver.Id && o.Status == OrderStatus.PickedUp);
            if (current == null) moved = 0;
            else
            {
                current.Status = OrderStatus.Delivered;
                current.UpdatedAt = DateTime.UtcNow;
                if (string.Equals(current.PaymentMethod, "COD", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(current.PaymentStatus, "PENDING", StringComparison.OrdinalIgnoreCase))
                    current.PaymentStatus = "PAID";
                await _db.SaveChangesAsync();
                moved = 1;
            }
        }
        else
        {
            moved = await _db.FoodOrders
                .Where(o => o.Id == id && o.DriverId == driver.Id && o.Status == OrderStatus.PickedUp)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Status, OrderStatus.Delivered)
                    .SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
        }
        if (moved == 0)
            return BadRequest(ApiResponse.Fail("Pick up the order before marking it delivered"));

        if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) != true &&
            string.Equals(order.PaymentMethod, "COD", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(order.PaymentStatus, "PENDING", StringComparison.OrdinalIgnoreCase))
        {
            await _db.FoodOrders.Where(o => o.Id == id && o.PaymentStatus == "PENDING")
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.PaymentStatus, "PAID"));
        }

        await PublishFoodStatus(id, OrderStatus.Delivered, driver);
        return Ok(ApiResponse.Ok("Order delivered"));
    }

    private async Task PublishFoodAssignment(FoodOrder order, Driver driver, string eventName)
    {
        var payload = new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            status = OrderStatus.Ready,
            driverId = driver.Id,
            driverName = driver.User?.FullName,
            driverPhone = driver.User?.MobileNumber,
            updatedAt = DateTime.UtcNow
        };
        if (_orderHub != null)
            await _orderHub.Clients.Group($"order-{order.Id}").SendAsync("OrderStatusUpdated", payload);
        await _hub.Clients.Group("drivers-pool").SendAsync("FoodDeliveryAccepted", payload);
        if (order.UserId > 0 && _notificationService != null)
        {
            await _notificationService.SendPushNotificationAsync(
                order.UserId,
                "Captain assigned",
                $"{driver.User?.FullName ?? "Your captain"} accepted order {order.OrderNumber}.",
                "FOOD_ORDER",
                order.OrderNumber);
        }
        _ = eventName;
    }

    private async Task PublishFoodStatus(long orderId, string status, Driver driver)
    {
        var order = await _db.FoodOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) return;
        var payload = new
        {
            orderId,
            status,
            driverId = driver.Id,
            driverName = driver.User?.FullName,
            message = $"Order is now {status}",
            updatedAt = DateTime.UtcNow
        };
        if (_orderHub != null)
            await _orderHub.Clients.Group($"order-{orderId}").SendAsync("OrderStatusUpdated", payload);
        await _hub.Clients.Group("drivers-pool").SendAsync("FoodDeliveryStatusChanged", payload);

        var title = status == OrderStatus.Delivered ? "Order delivered" : "Order picked up";
        var body = status == OrderStatus.Delivered
            ? $"Order {order.OrderNumber} has been delivered."
            : $"Captain picked up order {order.OrderNumber}.";
        _db.Notifications.Add(new Notification
        {
            UserId = order.UserId,
            Title = title,
            Body = body,
            Type = "FOOD_ORDER",
            ReferenceId = order.OrderNumber,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        if (_notificationService != null)
            await _notificationService.SendPushNotificationAsync(order.UserId, title, body, "FOOD_ORDER", order.OrderNumber);
    }

    private static FoodOrderDto MapFood(FoodOrder o, User? customer = null)
    {
        return new FoodOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            RestaurantId = o.RestaurantId,
            RestaurantName = o.Restaurant?.Name ?? "Restaurant",
            RestaurantPhone = o.Restaurant?.Phone,
            RestaurantAddress = o.Restaurant?.AddressLine,
            DeliveryAddress = o.Address == null ? null : $"{o.Address.AddressLine1}, {o.Address.City}",
            CustomerPhone = customer?.MobileNumber ?? o.User?.MobileNumber,
            Status = o.Status,
            GrandTotal = o.GrandTotal,
            SubTotal = o.SubTotal,
            DeliveryFee = o.DeliveryFee,
            TaxAmount = o.TaxAmount,
            PaymentMethod = o.PaymentMethod,
            PaymentStatus = o.PaymentStatus,
            DriverId = o.DriverId,
            DriverName = o.Driver?.User?.FullName,
            DriverPhone = o.Driver?.User?.MobileNumber,
            CreatedAt = o.CreatedAt,
            Items = o.Items?.Select(i => new FoodOrderItemDto
            {
                Id = i.Id,
                FoodItemId = i.FoodItemId,
                ItemName = i.ItemName,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                TotalPrice = i.TotalPrice
            }).ToList() ?? new()
        };
    }
}
