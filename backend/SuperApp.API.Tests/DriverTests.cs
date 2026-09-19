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
    public async Task Driver_ToggleOnline_UpdatesDutyStatus()
    {
        var (db, hub) = CreateContext();
        var user = new User { Id = 21, MobileNumber = "9876500002", FullName = "Ramesh Driver" };
        db.Users.Add(user);
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

        var driver = new Driver { Id = 99, UserId = user.Id, IsActive = true, TotalRides = 10 };
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

        var driver = await db.Drivers.FirstOrDefaultAsync(d => d.UserId == 24);
        Assert.NotNull(driver);
        Assert.Equal(28.7041m, driver!.CurrentLatitude);
        Assert.Equal(77.1025m, driver.CurrentLongitude);
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
