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

    private async Task<(List<RideFareRule> rules, List<RideFareOption> options)> LoadFareConfigAsync()
    {
        var rules = await _db.RideFareRules.AsNoTracking().Where(r => r.IsActive).ToListAsync();
        var options = await _db.RideFareOptions.AsNoTracking().ToListAsync();
        if (rules.Count == 0) rules = RideFareEngine.DefaultRules();
        if (options.Count == 0) options = RideFareEngine.DefaultOptions();

        // Check if Admin has configured ride fare settings in AppSettings
        var rideSettings = await _db.AppSettings
            .AsNoTracking()
            .Where(s => s.SettingKey.StartsWith("ride_") || s.SettingKey == "surge_pricing_multiplier")
            .ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue);

        if (rideSettings.Count > 0)
        {
            if (rideSettings.TryGetValue("surge_pricing_multiplier", out var surgeStr) && decimal.TryParse(surgeStr, out var surgeVal) && surgeVal > 0)
            {
                foreach (var rule in rules)
                {
                    rule.PeakMultiplier = surgeVal;
                }
            }

            void ApplyTierOverrides(string vehicleType, string prefix)
            {
                var rule = rules.FirstOrDefault(r => r.VehicleType.Equals(vehicleType, StringComparison.OrdinalIgnoreCase));
                if (rule != null)
                {
                    if (rideSettings.TryGetValue($"{prefix}_base_fare", out var baseStr) && decimal.TryParse(baseStr, out var baseVal) && baseVal >= 0)
                        rule.BaseFare = baseVal;
                    if (rideSettings.TryGetValue($"{prefix}_per_km_rate", out var perKmStr) && decimal.TryParse(perKmStr, out var perKmVal) && perKmVal >= 0)
                        rule.PerKmRate = perKmVal;
                    if (rideSettings.TryGetValue($"{prefix}_minimum_fare", out var minStr) && decimal.TryParse(minStr, out var minVal) && minVal >= 0)
                        rule.MinimumFare = minVal;
                }
            }

            ApplyTierOverrides(VehicleTypes.Bike, "ride_bike");
            ApplyTierOverrides(VehicleTypes.Auto, "ride_auto");
            ApplyTierOverrides(VehicleTypes.Cab, "ride_cab");
        }

        return (rules, options);
    }

    private async Task<(List<VehicleEstimateDto> vehicles, List<RideOptionDto> addons)> QuoteVehiclesAsync(
        decimal distanceKm, int minutes, List<string>? optionCodes)
    {
        var (rules, catalog) = await LoadFareConfigAsync();
        var now = DateTime.UtcNow;
        VehicleEstimateDto Map(string type, string title, string tag, string subtitle, int eta, string icon)
        {
            var rule = rules.First(r => r.VehicleType == type);
            var quote = RideFareEngine.Quote(rule, catalog, optionCodes, distanceKm, minutes, now);
            return new VehicleEstimateDto
            {
                VehicleType = type,
                Title = title,
                Tag = tag,
                Subtitle = subtitle,
                EstimatedFare = quote.Total,
                EtaMinutes = eta,
                IconName = icon,
                BaseFare = quote.BaseFare,
                DistanceFare = quote.DistanceFare,
                TimeFare = quote.TimeFare,
                BookingFee = quote.BookingFee,
                PlatformFee = quote.PlatformFee,
                OptionsTotal = quote.OptionsTotal,
                Tax = quote.Tax
            };
        }

        var vehicles = new List<VehicleEstimateDto>
        {
            Map(VehicleTypes.Bike, "Bike Taxi", "FASTEST", "Beat traffic • Helmet provided", 3, "two_wheeler"),
            Map(VehicleTypes.Auto, "Auto Rickshaw", "VALUE", "Direct drop • Max 3 seats", 5, "electric_rickshaw"),
            Map(VehicleTypes.Cab, "Economy Cab", "COMFORT", "AC Hatchback • Luggage space", 7, "directions_car")
        };
        var addons = catalog.Where(o => o.IsEnabled).Select(o => new RideOptionDto
        {
            Code = o.Code,
            Name = o.Name,
            Description = o.Description,
            AdditionalAmount = o.AdditionalAmount,
            Enabled = o.IsEnabled
        }).ToList();
        return (vehicles, addons);
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
        if (distanceKm < 0.15m)
            return BadRequest(ApiResponse<RideEstimateResponse>.Fail("Pickup and destination are the same place"));

        List<VehicleEstimateDto> options;
        List<RideOptionDto> addons;
        try
        {
            (options, addons) = await QuoteVehiclesAsync(distanceKm, estimatedMinutes, request.OptionCodes);
        }
        catch (InvalidFareException ex)
        {
            return BadRequest(ApiResponse<RideEstimateResponse>.Fail(ex.Message));
        }

        return Ok(ApiResponse<RideEstimateResponse>.Ok(new RideEstimateResponse
        {
            DistanceKm = distanceKm,
            EstimatedMinutes = estimatedMinutes,
            TrafficCondition = "Moderate Traffic",
            VehicleOptions = options,
            AvailableOptions = addons
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
        var rideNumber = $"RD-{Guid.NewGuid().ToString("N")[..16]}";

        var route = await _mapService.EstimateRouteAsync(
            request.PickupLatitude,
            request.PickupLongitude,
            request.DropoffLatitude,
            request.DropoffLongitude);
        var distanceKm = (decimal)route.DistanceKm;
        if (distanceKm < 0.15m)
            return BadRequest(ApiResponse<RideDto>.Fail("Pickup and destination are the same place"));

        if (!VehicleTypes.TryNormalize(request.VehicleType, out var vehicleType))
            return BadRequest(ApiResponse<RideDto>.Fail("Unsupported vehicle type. Allowed values: BIKE, AUTO, CAB."));
        FareComputation quote;
        try
        {
            var (rules, catalog) = await LoadFareConfigAsync();
            var rule = rules.FirstOrDefault(r => r.VehicleType == vehicleType);
            if (rule == null)
                return BadRequest(ApiResponse<RideDto>.Fail("Unsupported vehicle type. Allowed values: BIKE, AUTO, CAB."));
            quote = RideFareEngine.Quote(rule, catalog, request.OptionCodes, distanceKm, route.EstimatedDurationMinutes, DateTime.UtcNow);
        }
        catch (InvalidFareException ex)
        {
            return BadRequest(ApiResponse<RideDto>.Fail(ex.Message));
        }

        var ride = new Ride
        {
            RideNumber = rideNumber,
            UserId = userId.Value,
            VehicleType = vehicleType,
            PickupAddress = request.PickupAddress,
            PickupLatitude = request.PickupLatitude,
            PickupLongitude = request.PickupLongitude,
            DropoffAddress = request.DropoffAddress,
            DropoffLatitude = request.DropoffLatitude,
            DropoffLongitude = request.DropoffLongitude,
            DistanceKm = distanceKm,
            EstimatedFare = quote.Total,
            FareBreakdown = $"base={quote.BaseFare};distance={quote.DistanceFare};time={quote.TimeFare};booking={quote.BookingFee};platform={quote.PlatformFee};options={quote.OptionsTotal};tax={quote.Tax};total={quote.Total}",
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

            // Broadcast real push notification to ALL registered captains (regardless of online/offline status)
            try
            {
                await _notificationService.BroadcastRideToAllCaptainsAsync(ride);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PushDispatch] Error broadcasting ride {ride.Id} to captains: {ex.Message}");
            }
        }

        // Broadcast to all drivers in drivers-pool via SignalR for connected captains
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
            Driver = null
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

        // Automatic 5-minute expiry enforcement covering REQUESTED and SEARCHING
        if (ride.DriverId == null && (ride.Status == RideStatus.Requested || ride.Status == RideStatus.Searching) && ride.CreatedAt < DateTime.UtcNow.AddMinutes(-5))
        {
            ride.Status = RideStatus.Expired;
            ride.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _rideHub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
            {
                rideId = ride.Id,
                status = RideStatus.Expired,
                reason = "No driver accepted within 5 minutes.",
                updatedAt = ride.UpdatedAt
            });
            await _rideHub.Clients.Group("drivers-pool").SendAsync("RideExpired", new
            {
                rideId = ride.Id,
                status = RideStatus.Expired
            });
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

        if (ride.Status == RideStatus.Cancelled)
            return Conflict(ApiResponse.Fail("Cannot start a cancelled ride"));

        if (ride.Status == RideStatus.Completed)
            return Conflict(ApiResponse.Fail("Ride has already been completed"));

        if (ride.Status == RideStatus.Expired)
            return Conflict(ApiResponse.Fail("Cannot start an expired ride"));

        if (ride.Status != RideStatus.Accepted && ride.Status != RideStatus.Arriving)
            return Conflict(ApiResponse.Fail($"Cannot start ride with status '{ride.Status}'. Must be ACCEPTED or ARRIVING."));

        var now = DateTime.UtcNow;
        if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            ride.Status = RideStatus.Started;
            ride.StartedAt = now;
            ride.UpdatedAt = now;
            await _db.SaveChangesAsync();
        }
        else
        {
            var updatedRows = await _db.Rides
                .Where(r => r.Id == ride.Id && (r.Status == RideStatus.Accepted || r.Status == RideStatus.Arriving))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(r => r.Status, RideStatus.Started)
                    .SetProperty(r => r.StartedAt, now)
                    .SetProperty(r => r.UpdatedAt, now));

            if (updatedRows == 0)
            {
                var refreshed = await _db.Rides.Where(r => r.Id == ride.Id).Select(r => r.Status).FirstOrDefaultAsync();
                return Conflict(ApiResponse.Fail($"Cannot start ride. Current state is '{refreshed ?? "UNKNOWN"}'."));
            }

            ride.Status = RideStatus.Started;
            ride.StartedAt = now;
            ride.UpdatedAt = now;
            _db.Entry(ride).Property(r => r.Status).IsModified = false;
        }

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

        if (ride.Status != RideStatus.Started)
        {
            return BadRequest(ApiResponse.Fail($"Cannot complete a ride with status '{ride.Status}'. The ride must be in STARTED status to be completed."));
        }

        RideCompletion.MarkCompleted(ride);
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

        if (ride.Status == RideStatus.Started || ride.Status == RideStatus.Completed || ride.Status == RideStatus.Expired)
            return BadRequest(ApiResponse.Fail("Active, completed, or expired rides cannot be cancelled"));

        var previousStatus = ride.Status;
        var reason = request?.Reason ?? (isRider ? "Cancelled by passenger" : "Cancelled by driver");
        var now = DateTime.UtcNow;

        if (_db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
        {
            if (ride.Status == RideStatus.Started || ride.Status == RideStatus.Completed || ride.Status == RideStatus.Expired)
                return BadRequest(ApiResponse.Fail("Active, completed, or expired rides cannot be cancelled"));

            ride.Status = RideStatus.Cancelled;
            ride.CancelledAt = now;
            ride.CancellationReason = reason;
            ride.UpdatedAt = now;
            await _db.SaveChangesAsync();
        }
        else
        {
            var affected = await _db.Rides
                .Where(r => r.Id == ride.Id && r.Status != RideStatus.Started && r.Status != RideStatus.Completed && r.Status != RideStatus.Cancelled && r.Status != RideStatus.Expired)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(r => r.Status, RideStatus.Cancelled)
                    .SetProperty(r => r.CancelledAt, now)
                    .SetProperty(r => r.CancellationReason, reason)
                    .SetProperty(r => r.UpdatedAt, now));

            if (affected == 0)
            {
                var refreshed = await _db.Rides.AsNoTracking().FirstOrDefaultAsync(r => r.Id == ride.Id);
                if (refreshed?.Status == RideStatus.Started || refreshed?.Status == RideStatus.Completed)
                    return BadRequest(ApiResponse.Fail("Ride was already started or completed and cannot be cancelled"));
                if (refreshed?.Status == RideStatus.Expired)
                    return BadRequest(ApiResponse.Fail("Ride has already expired"));
                return Ok(ApiResponse.Ok("Ride already cancelled"));
            }

            ride.Status = RideStatus.Cancelled;
            ride.CancelledAt = now;
            ride.CancellationReason = reason;
            ride.UpdatedAt = now;
        }

        await _rideHub.Clients.Group($"ride-{ride.Id}").SendAsync("RideStatusChanged", new
        {
            rideId = ride.Id,
            status = ride.Status,
            reason = ride.CancellationReason,
            cancelledAt = ride.CancelledAt
        });

        // Always broadcast cancellation to drivers-pool so any online driver screens or open modals instantly discard it
        await _rideHub.Clients.Group("drivers-pool").SendAsync("RideCancelled", new
        {
            rideId = ride.Id,
            status = ride.Status
        });

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
