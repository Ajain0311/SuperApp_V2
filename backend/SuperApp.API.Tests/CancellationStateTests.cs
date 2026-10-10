using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using Xunit;
using Microsoft.AspNetCore.SignalR;
using Moq;
using SuperApp.API.Hubs;
using SuperApp.API.Services;

namespace SuperApp.API.Tests;

public class CancellationStateTests
{
    private static AppDbContext Db()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static DriverController DriverApi(AppDbContext db, long userId)
    {
        var controller = new DriverController(db, new FakeHubContext());
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, "DRIVER")
        }, "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    [Fact]
    public async Task DriverCancelsRide_ReturnsToPool()
    {
        var db = Db();
        var user = new User { Id = 1, MobileNumber = "9000000001", FullName = "Rider" };
        var driverUser = new User { Id = 2, MobileNumber = "9000000002", FullName = "Driver" };
        var driver = new Driver { Id = 1, UserId = 2, CurrentLatitude = 0, CurrentLongitude = 0 };
        db.Users.AddRange(user, driverUser);
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 1,
            RideNumber = "RD-TEST",
            UserId = user.Id,
            DriverId = driver.Id,
            VehicleType = "CAB",
            Status = RideStatus.Accepted,
            CreatedAt = DateTime.UtcNow
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var api = DriverApi(db, driverUser.Id);
        var res = await api.CancelRide(ride.Id, new CancelRideRequest { Reason = "Tire flat" });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var storedRide = await db.Rides.FindAsync(ride.Id);
        
        Assert.NotNull(storedRide); // Persists in DB
        Assert.Null(storedRide.DriverId); // Driver unassigned
        Assert.Equal(RideStatus.Searching, storedRide.Status); // Returns to pool
        Assert.Equal("Tire flat", storedRide.CancellationReason);
    }

    [Fact]
    public async Task CaptainUnassignsFoodOrder_ReturnsToReadyQueue()
    {
        var db = Db();
        var user = new User { Id = 1, MobileNumber = "9000000001", FullName = "Customer" };
        var captainUser = new User { Id = 2, MobileNumber = "9000000002", FullName = "Captain" };
        var driver = new Driver { Id = 1, UserId = 2, CurrentLatitude = 0, CurrentLongitude = 0 };
        db.Users.AddRange(user, captainUser);
        db.Drivers.Add(driver);

        var order = new FoodOrder
        {
            Id = 1,
            OrderNumber = "FO-TEST",
            UserId = user.Id,
            DriverId = driver.Id,
            Status = OrderStatus.Ready,
            CreatedAt = DateTime.UtcNow
        };
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();

        var api = DriverApi(db, captainUser.Id);
        var res = await api.UnassignFoodOrder(order.Id);

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var storedOrder = await db.FoodOrders.FindAsync(order.Id);
        
        Assert.NotNull(storedOrder); // Persists in DB
        Assert.Null(storedOrder.DriverId); // Captain unassigned
        Assert.Equal(OrderStatus.Ready, storedOrder.Status); // Returns to pool
    }
}
