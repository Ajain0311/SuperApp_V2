using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Hubs;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class DriverTests
{
    private (AppDbContext db, IHubContext<RideTrackingHub> hub) CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        var hub = new FakeHubContext();

        return (db, hub);
    }

    private DriverController CreateController(AppDbContext db, IHubContext<RideTrackingHub> hub, long userId, string role)
    {
        var controller = new DriverController(db, hub);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    [Fact]
    public async Task Driver_WithoutDriverRole_ReturnsForbid()
    {
        var (db, hub) = CreateContext();
        var controller = CreateController(db, hub, 10, RoleNames.Customer);

        var result = await controller.GetProfile();

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task Driver_WithDriverRole_CanAccessProfile_AndVehicle()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 20, MobileNumber = "9876500001", FullName = "Suresh Driver" };
        db.Users.Add(user);
        var driver = new Driver { Id = 200, UserId = 20, IsActive = true, IsVerified = true, IsOnline = true, LicenseNumber = "DL-200" };
        var vehicle = new Vehicle { Id = 500, DriverId = 200, Type = VehicleTypes.Bike, Make = "Hero", Model = "Splendor Plus", RegistrationNumber = "DL 01 AB 1234", Color = "Black", Year = 2024, IsActive = true };
        db.Drivers.Add(driver);
        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 20, RoleNames.Driver);

        var result = await controller.GetProfile();
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse<DriverProfileDto>>(okResult.Value);

        Assert.True(apiRes.Success);
        Assert.Equal("Suresh Driver", apiRes.Data!.FullName);
        Assert.NotNull(apiRes.Data.Vehicle);
        Assert.Equal("Hero", apiRes.Data.Vehicle!.Make);
    }

    [Fact]
    public async Task Driver_UnverifiedOrUnprovisioned_ReturnsForbid()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 29, MobileNumber = "9876500099", FullName = "Unverified Driver" };
        db.Users.Add(user);
        // Driver exists but not verified yet
        var unverifiedDriver = new Driver { Id = 290, UserId = 29, IsActive = true, IsVerified = false, LicenseNumber = "DL-UNVERIFIED" };
        db.Drivers.Add(unverifiedDriver);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 29, RoleNames.Driver);
        var result = await controller.GetProfile();
        Assert.IsType<ForbidResult>(result.Result);

        // Driver does not exist at all
        var userNoRecord = new User { Id = 30, MobileNumber = "9876500030", FullName = "No Driver Row" };
        db.Users.Add(userNoRecord);
        await db.SaveChangesAsync();

        var controllerNoRecord = CreateController(db, hub, 30, RoleNames.Driver);
        var resultNoRecord = await controllerNoRecord.GetProfile();
        Assert.IsType<ForbidResult>(resultNoRecord.Result);
    }

    [Fact]
    public async Task Driver_ToggleOnline_UpdatesDutyStatus()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 21, MobileNumber = "9876500002", FullName = "Ramesh Driver" };
        db.Users.Add(user);
        var driver = new Driver { Id = 210, UserId = 21, IsActive = true, IsVerified = true, IsOnline = true, LicenseNumber = "DL-210" };
        db.Drivers.Add(driver);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 21, RoleNames.Driver);

        // Toggle to offline
        var res1 = await controller.ToggleOnline(new ToggleOnlineRequest { IsOnline = false });
        var ok1 = Assert.IsType<OkObjectResult>(res1.Result);
        var apiRes1 = Assert.IsType<ApiResponse<bool>>(ok1.Value);
        Assert.False(apiRes1.Data);

        // Toggle back to online
        var res2 = await controller.ToggleOnline(new ToggleOnlineRequest { IsOnline = true });
        var ok2 = Assert.IsType<OkObjectResult>(res2.Result);
        var apiRes2 = Assert.IsType<ApiResponse<bool>>(ok2.Value);
        Assert.True(apiRes2.Data);
    }

    [Fact]
    public async Task Driver_AcceptRide_AssignsDriver_AndChangesStatus()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 22, MobileNumber = "9876500003", FullName = "Vikram Driver" };
        var passenger = new User { Id = 50, MobileNumber = "9876599999", FullName = "Pooja Passenger" };
        db.Users.AddRange(user, passenger);
        var driver = new Driver { Id = 220, UserId = 22, IsActive = true, IsVerified = true, IsOnline = true, LicenseNumber = "DL-220" };
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 101,
            RideNumber = "RD-101",
            UserId = passenger.Id,
            VehicleType = "BIKE",
            PickupAddress = "City Center",
            DropoffAddress = "Railway Station",
            EstimatedFare = 50,
            Status = RideStatus.Requested,
            OtpCode = "7788"
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 22, RoleNames.Driver);

        var result = await controller.AcceptRide(101);
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse<RideDto>>(okResult.Value);

        Assert.True(apiRes.Success);
        Assert.Equal(RideStatus.Accepted, apiRes.Data!.Status);

        var savedRide = await db.Rides.FindAsync(101L);
        Assert.NotNull(savedRide!.DriverId);
        Assert.Equal(RideStatus.Accepted, savedRide.Status);
    }

    [Fact]
    public async Task Driver_FullRideLifecycle_Arriving_StartOtp_Complete()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 23, MobileNumber = "9876500004", FullName = "Anil Driver" };
        var passenger = new User { Id = 51, MobileNumber = "9876588888", FullName = "Rahul Passenger" };
        db.Users.AddRange(user, passenger);

        var driver = new Driver { Id = 99, UserId = user.Id, IsActive = true, IsVerified = true, TotalRides = 10, LicenseNumber = "DL-99" };
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 202,
            RideNumber = "RD-202",
            UserId = passenger.Id,
            DriverId = driver.Id,
            VehicleType = "BIKE",
            PickupAddress = "Mall",
            DropoffAddress = "Airport",
            EstimatedFare = 150,
            Status = RideStatus.Accepted,
            OtpCode = "4321"
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 23, RoleNames.Driver);

        // 1. Arriving
        var arrivingRes = await controller.MarkArriving(202);
        Assert.IsType<OkObjectResult>(arrivingRes.Result);
        var rideAfterArriving = await db.Rides.FindAsync(202L);
        Assert.Equal(RideStatus.Arriving, rideAfterArriving!.Status);

        // 2. Start with Invalid OTP -> Fails
        var invalidOtpRes = await controller.StartRide(202, new VerifyRideOtpRequest { OtpCode = "0000" });
        Assert.IsType<BadRequestObjectResult>(invalidOtpRes.Result);

        // 3. Start with Valid OTP -> Starts
        var startRes = await controller.StartRide(202, new VerifyRideOtpRequest { OtpCode = "4321" });
        Assert.IsType<OkObjectResult>(startRes.Result);
        var rideAfterStart = await db.Rides.FindAsync(202L);
        Assert.Equal(RideStatus.Started, rideAfterStart!.Status);

        // 4. Complete ride
        var completeRes = await controller.CompleteRide(202);
        Assert.IsType<OkObjectResult>(completeRes.Result);
        var rideAfterComplete = await db.Rides.FindAsync(202L);
        Assert.Equal(RideStatus.Completed, rideAfterComplete!.Status);
        Assert.Equal(150, rideAfterComplete.ActualFare);

        // Verify driver total rides incremented
        var updatedDriver = await db.Drivers.FindAsync(99L);
        Assert.Equal(11, updatedDriver!.TotalRides);
    }

    [Fact]
    public async Task Driver_UpdateLocation_PersistsCoordinates()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 24, MobileNumber = "9876500005", FullName = "Deepak Driver" };
        db.Users.Add(user);
        var driver = new Driver { Id = 240, UserId = 24, IsActive = true, IsVerified = true, LicenseNumber = "DL-240" };
        db.Drivers.Add(driver);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 24, RoleNames.Driver);

        var res = await controller.UpdateLocation(new UpdateDriverLocationRequest
        {
            Latitude = 28.7041m,
            Longitude = 77.1025m,
            Heading = 180,
            Speed = 35.5
        });

        Assert.IsType<OkObjectResult>(res.Result);

        var savedDriver = await db.Drivers.FirstOrDefaultAsync(d => d.UserId == 24);
        Assert.NotNull(savedDriver);
        Assert.Equal(28.7041m, savedDriver!.CurrentLatitude);
        Assert.Equal(77.1025m, savedDriver.CurrentLongitude);
    }

    [Fact]
    public async Task Driver_UpdateLocation_RejectsInvalidCoordinates()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 25, MobileNumber = "9876500006", FullName = "Invalid Coord Driver" };
        db.Users.Add(user);
        var driver = new Driver { Id = 250, UserId = 25, IsActive = true, IsVerified = true, LicenseNumber = "DL-250" };
        db.Drivers.Add(driver);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 25, RoleNames.Driver);

        // Latitude > 90
        var res1 = await controller.UpdateLocation(new UpdateDriverLocationRequest
        {
            Latitude = 95.0m,
            Longitude = 77.1025m
        });
        Assert.IsType<BadRequestObjectResult>(res1.Result);

        // Longitude > 180
        var res2 = await controller.UpdateLocation(new UpdateDriverLocationRequest
        {
            Latitude = 28.7041m,
            Longitude = 185.0m
        });
        Assert.IsType<BadRequestObjectResult>(res2.Result);

        // Zero coordinates (0, 0)
        var res3 = await controller.UpdateLocation(new UpdateDriverLocationRequest
        {
            Latitude = 0m,
            Longitude = 0m
        });
        Assert.IsType<BadRequestObjectResult>(res3.Result);
    }

    [Fact]
    public async Task Driver_ConcurrentAccept_OnlyOneDriverWins()
    {
        var (db, hub) = CreateContext();
        var driverUser1 = new User { Id = 31, MobileNumber = "9876500031", FullName = "Driver One" };
        var driverUser2 = new User { Id = 32, MobileNumber = "9876500032", FullName = "Driver Two" };
        var passenger = new User { Id = 60, MobileNumber = "9876500060", FullName = "Passenger User" };
        db.Users.AddRange(driverUser1, driverUser2, passenger);
        var driver1 = new Driver { Id = 310, UserId = 31, IsActive = true, IsVerified = true, IsOnline = true, LicenseNumber = "DL-310" };
        var driver2 = new Driver { Id = 320, UserId = 32, IsActive = true, IsVerified = true, IsOnline = true, LicenseNumber = "DL-320" };
        db.Drivers.AddRange(driver1, driver2);

        var ride = new Ride
        {
            Id = 303,
            RideNumber = "RD-303",
            UserId = passenger.Id,
            VehicleType = "BIKE",
            PickupAddress = "Location A",
            DropoffAddress = "Location B",
            EstimatedFare = 80,
            Status = RideStatus.Requested,
            OtpCode = "1234"
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller1 = CreateController(db, hub, 31, RoleNames.Driver);
        var controller2 = CreateController(db, hub, 32, RoleNames.Driver);

        // Driver 1 accepts
        var res1 = await controller1.AcceptRide(303);
        var ok1 = Assert.IsType<OkObjectResult>(res1.Result);
        var apiRes1 = Assert.IsType<ApiResponse<RideDto>>(ok1.Value);
        Assert.True(apiRes1.Success);

        // Driver 2 attempts to accept same ride -> Conflict
        var res2 = await controller2.AcceptRide(303);
        Assert.IsType<ConflictObjectResult>(res2.Result);

        var finalRide = await db.Rides.FindAsync(303L);
        var driver1Record = await db.Drivers.FirstOrDefaultAsync(d => d.UserId == 31);
        Assert.Equal(driver1Record!.Id, finalRide!.DriverId);
    }

    [Fact]
    public async Task AutoMarkArrived_WhenDisabledByDefault_DoesNotChangeStatusEvenWithinGeofence()
    {
        var (db, hub) = CreateContext();
        var driverUser = new User { Id = 40, MobileNumber = "9876500040", FullName = "Auto Arrive Driver" };
        var passenger = new User { Id = 70, MobileNumber = "9876500070", FullName = "Passenger Auto" };
        db.Users.AddRange(driverUser, passenger);

        var driver = new Driver
        {
            Id = 400,
            UserId = driverUser.Id,
            LicenseNumber = "DL-AUTO-400",
            IsVerified = true,
            IsOnline = true,
            CurrentLatitude = 28.6315m,
            CurrentLongitude = 77.2167m
        };
        db.Drivers.Add(driver);

        // Ride accepted by driver at exact same coordinates (distance = 0m < 20m)
        var ride = new Ride
        {
            Id = 404,
            RideNumber = "RD-404",
            UserId = passenger.Id,
            DriverId = driver.Id,
            VehicleType = "BIKE",
            PickupAddress = "Connaught Place",
            PickupLatitude = 28.6315m,
            PickupLongitude = 77.2167m,
            DropoffAddress = "Hauz Khas",
            DropoffLatitude = 28.5494m,
            DropoffLongitude = 77.2001m,
            EstimatedFare = 120,
            Status = RideStatus.Accepted,
            OtpCode = "5555"
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 40, RoleNames.Driver);

        // Update location right on top of pickup point
        var res = await controller.UpdateLocation(new UpdateDriverLocationRequest
        {
            Latitude = 28.6315m,
            Longitude = 77.2167m,
            RideId = 404
        });

        Assert.IsType<OkObjectResult>(res.Result);

        // Feature flag is disabled by default (or missing). Status MUST remain Accepted!
        var verifiedRide = await db.Rides.FindAsync(404L);
        Assert.NotNull(verifiedRide);
        Assert.Equal(RideStatus.Accepted, verifiedRide!.Status);
    }

    [Fact]
    public async Task AutoMarkArrived_WhenExplicitlyEnabledByAdmin_TransitionsToArrivingWithinGeofence()
    {
        var (db, hub) = CreateContext();
        var driverUser = new User { Id = 41, MobileNumber = "9876500041", FullName = "Auto Arrive Driver 2" };
        var passenger = new User { Id = 71, MobileNumber = "9876500071", FullName = "Passenger Auto 2" };
        db.Users.AddRange(driverUser, passenger);

        // Admin enables feature flag in AppSettings
        db.AppSettings.AddRange(
            new AppSetting { SettingKey = "Ride.AutoMarkArrivedEnabled", SettingValue = "true", UpdatedAt = DateTime.UtcNow },
            new AppSetting { SettingKey = "Ride.AutoMarkArrivedRadiusMeters", SettingValue = "20", UpdatedAt = DateTime.UtcNow }
        );

        var driver = new Driver
        {
            Id = 401,
            UserId = driverUser.Id,
            LicenseNumber = "DL-AUTO-401",
            IsVerified = true,
            IsOnline = true,
            CurrentLatitude = 28.6315m,
            CurrentLongitude = 77.2167m
        };
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 405,
            RideNumber = "RD-405",
            UserId = passenger.Id,
            DriverId = driver.Id,
            VehicleType = "CAB",
            PickupAddress = "Connaught Place Inner Circle",
            PickupLatitude = 28.6315000m,
            PickupLongitude = 77.2167000m,
            DropoffAddress = "Airport T3",
            DropoffLatitude = 28.5562m,
            DropoffLongitude = 77.1000m,
            EstimatedFare = 350,
            Status = RideStatus.Accepted,
            OtpCode = "8899"
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 41, RoleNames.Driver);

        // Location 5 meters away from pickup (within 20m radius)
        var res = await controller.UpdateLocation(new UpdateDriverLocationRequest
        {
            Latitude = 28.6315400m,
            Longitude = 77.2167000m,
            RideId = 405
        });

        Assert.IsType<OkObjectResult>(res.Result);

        // Since flag is enabled and driver is within 20m, status atomically updates to ARRIVING
        var verifiedRide = await db.Rides.FindAsync(405L);
        Assert.NotNull(verifiedRide);
        Assert.Equal(RideStatus.Arriving, verifiedRide!.Status);
    }

    [Fact]
    public async Task GetActiveRide_ReturnsPickupAndDropoffCoordinates()
    {
        var (db, hub) = CreateContext();
        var driverUser = new User { Id = 42, MobileNumber = "9876500042", FullName = "Coords Driver" };
        var passenger = new User { Id = 72, MobileNumber = "9876500072", FullName = "Passenger Coords" };
        db.Users.AddRange(driverUser, passenger);

        var driver = new Driver
        {
            Id = 402,
            UserId = driverUser.Id,
            LicenseNumber = "DL-AUTO-402",
            IsVerified = true,
            IsOnline = true,
            CurrentLatitude = 28.6315m,
            CurrentLongitude = 77.2167m
        };
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 406,
            RideNumber = "RD-406",
            UserId = passenger.Id,
            DriverId = driver.Id,
            VehicleType = "BIKE",
            PickupAddress = "Delhi Cantt",
            PickupLatitude = 28.5880m,
            PickupLongitude = 77.1234m,
            DropoffAddress = "Connaught Place",
            DropoffLatitude = 28.6315m,
            DropoffLongitude = 77.2167m,
            EstimatedFare = 150,
            Status = RideStatus.Accepted,
            OtpCode = "3344"
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, 42, RoleNames.Driver);
        var res = await controller.GetActiveRide();

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse<RideDto?>>(ok.Value);
        Assert.NotNull(apiRes.Data);
        Assert.Equal(28.5880m, apiRes.Data!.PickupLatitude);
        Assert.Equal(77.1234m, apiRes.Data!.PickupLongitude);
        Assert.Equal(28.6315m, apiRes.Data!.DropoffLatitude);
        Assert.Equal(77.2167m, apiRes.Data!.DropoffLongitude);
    }

    [Fact]
    public async Task GetAvailableRides_DoesNotExposeOtpCode_ToDriverPool()
    {
        var (db, hub) = CreateContext();
        var passenger = new User { Id = 301, MobileNumber = "9876543210", FullName = "Passenger" };
        var driverUser = new User { Id = 302, MobileNumber = "9876543211", FullName = "Driver" };
        var driver = new Driver { Id = 55, UserId = driverUser.Id, IsOnline = true, IsVerified = true };
        db.Users.AddRange(passenger, driverUser);
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 888,
            RideNumber = "RD-888",
            UserId = passenger.Id,
            VehicleType = "BIKE",
            PickupAddress = "Origin",
            DropoffAddress = "Destination",
            EstimatedFare = 100,
            Status = RideStatus.Requested,
            OtpCode = "9988",
            CreatedAt = DateTime.UtcNow
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, driverUser.Id, RoleNames.Driver);
        var res = await controller.GetAvailableRides();

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse<List<DriverRideSummaryDto>>>(ok.Value);
        Assert.NotNull(apiRes.Data);
        var availableRide = Assert.Single(apiRes.Data!);
        Assert.Equal(888L, availableRide.Id);
        Assert.Null(availableRide.OtpCode);
    }

    [Theory]
    [InlineData(RideStatus.Cancelled)]
    [InlineData(RideStatus.Completed)]
    [InlineData(RideStatus.Expired)]
    [InlineData(RideStatus.Requested)]
    public async Task StartRide_FromInvalidStatus_ReturnsConflict(string initialStatus)
    {
        var (db, hub) = CreateContext();
        var passenger = new User { Id = 501, MobileNumber = "9876543220", FullName = "Passenger 501" };
        var driverUser = new User { Id = 502, MobileNumber = "9876543221", FullName = "Driver 502" };
        var driver = new Driver { Id = 77, UserId = driverUser.Id, IsOnline = true, IsVerified = true };
        db.Users.AddRange(passenger, driverUser);
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 999,
            RideNumber = "RD-999",
            UserId = passenger.Id,
            DriverId = driver.Id,
            VehicleType = "BIKE",
            PickupAddress = "Origin",
            DropoffAddress = "Destination",
            EstimatedFare = 100,
            Status = initialStatus,
            OtpCode = "1234",
            CreatedAt = DateTime.UtcNow
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, driverUser.Id, RoleNames.Driver);
        var res = await controller.StartRide(999, new VerifyRideOtpRequest { OtpCode = "1234" });

        var conflict = Assert.IsType<ConflictObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse>(conflict.Value);
        Assert.False(apiRes.Success);
    }

    [Theory]
    [InlineData(RideStatus.Requested)]
    [InlineData(RideStatus.Searching)]
    public async Task GetAvailableRides_SweepsStaleUnacceptedRides_ToExpired(string status)
    {
        var (db, hub) = CreateContext();
        var passenger = new User { Id = 601, MobileNumber = "9876543290", FullName = "Passenger 601" };
        var driverUser = new User { Id = 602, MobileNumber = "9876543291", FullName = "Driver 602" };
        var driver = new Driver { Id = 88, UserId = driverUser.Id, IsOnline = true, IsVerified = true };
        db.Users.AddRange(passenger, driverUser);
        db.Drivers.Add(driver);

        var staleRide = new Ride
        {
            Id = 1001,
            RideNumber = "RD-STALE-1",
            UserId = passenger.Id,
            VehicleType = "BIKE",
            PickupAddress = "Origin",
            DropoffAddress = "Destination",
            EstimatedFare = 100,
            Status = status,
            OtpCode = "1111",
            CreatedAt = DateTime.UtcNow.AddMinutes(-6) // Over 5 mins ago
        };
        db.Rides.Add(staleRide);
        await db.SaveChangesAsync();

        var controller = CreateController(db, hub, driverUser.Id, RoleNames.Driver);
        var res = await controller.GetAvailableRides();

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse<List<DriverRideSummaryDto>>>(ok.Value);
        Assert.NotNull(apiRes.Data);
        Assert.DoesNotContain(apiRes.Data!, r => r.Id == 1001);

        var refreshedRide = await db.Rides.FindAsync(1001L);
        Assert.NotNull(refreshedRide);
        Assert.Equal(RideStatus.Expired, refreshedRide!.Status);
    }
}




public class FakeHubContext : IHubContext<RideTrackingHub>
{
    public IHubClients Clients { get; } = new FakeHubClients();
    public IGroupManager Groups { get; } = new FakeGroupManager();
}

public class FakeHubClients : IHubClients
{
    public IClientProxy All => new FakeClientProxy();
    public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => new FakeClientProxy();
    public IClientProxy Client(string connectionId) => new FakeClientProxy();
    public IClientProxy Clients(IReadOnlyList<string> connectionIds) => new FakeClientProxy();
    public IClientProxy Group(string groupName) => new FakeClientProxy();
    public IClientProxy Groups(IReadOnlyList<string> groupNames) => new FakeClientProxy();
    public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => new FakeClientProxy();
    public IClientProxy User(string userId) => new FakeClientProxy();
    public IClientProxy Users(IReadOnlyList<string> userIds) => new FakeClientProxy();
}

public class FakeClientProxy : IClientProxy
{
    public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

public class FakeGroupManager : IGroupManager
{
    public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
