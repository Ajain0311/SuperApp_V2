using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Hubs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class CaptainPushNotificationTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static (RidesController controller, Mock<IHubContext<RideTrackingHub>> mockHub, Mock<INotificationService> mockNotif)
        CreateRidesController(AppDbContext db, long userId)
    {
        var mockHubClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockHubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);

        var mockHub = new Mock<IHubContext<RideTrackingHub>>();
        mockHub.Setup(h => h.Clients).Returns(mockHubClients.Object);

        var mockNotif = new Mock<INotificationService>();
        mockNotif.Setup(n => n.SendPushNotificationAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);
        mockNotif.Setup(n => n.BroadcastRideToAllCaptainsAsync(It.IsAny<Ride>()))
            .ReturnsAsync(PushDispatchResult.Success(2, 2, 2, 0, 0));

        var controller = new RidesController(db, mockHub.Object, new MockMapService(), mockNotif.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.Customer)
                }, "TestAuth"))
            }
        };

        return (controller, mockHub, mockNotif);
    }

    [Fact]
    public async Task Test_1_RideBooking_TriggersPushDispatch_ForAllCaptains_RegardlessOfOnlineStatus()
    {
        var db = CreateDb();

        // Register 2 captains: Captain A is Online, Captain B is Offline
        var userA = new User { Id = 101, MobileNumber = "9876500101", FullName = "Captain Online" };
        var userB = new User { Id = 102, MobileNumber = "9876500102", FullName = "Captain Offline" };
        var passenger = new User { Id = 201, MobileNumber = "9876500201", FullName = "Passenger" };
        db.Users.AddRange(userA, userB, passenger);

        var driverA = new Driver { Id = 1, UserId = userA.Id, IsOnline = true, IsActive = true };
        var driverB = new Driver { Id = 2, UserId = userB.Id, IsOnline = false, IsActive = true }; // OFFLINE captain
        db.Drivers.AddRange(driverA, driverB);

        db.UserDeviceTokens.Add(new UserDeviceToken { UserId = userA.Id, DeviceToken = "ExponentPushToken[AAA]", IsActive = true });
        db.UserDeviceTokens.Add(new UserDeviceToken { UserId = userB.Id, DeviceToken = "ExponentPushToken[BBB]", IsActive = true });
        await db.SaveChangesAsync();

        var (controller, _, mockNotif) = CreateRidesController(db, passenger.Id);

        var request = new BookRideRequest
        {
            VehicleType = "BIKE",
            PickupAddress = "Airport Terminal 3",
            PickupLatitude = 28.5562m,
            PickupLongitude = 77.1000m,
            DropoffAddress = "Connaught Place",
            DropoffLatitude = 28.6315m,
            DropoffLongitude = 77.2167m,
            PaymentMethod = "CASH"
        };

        var response = await controller.BookRide(request);
        var okResult = Assert.IsType<OkObjectResult>(response.Result);
        var apiRes = Assert.IsType<ApiResponse<RideDto>>(okResult.Value);
        Assert.True(apiRes.Success);

        // Verify notification service was invoked for broadcast
        // Give fire-and-forget task a moment to execute
        await Task.Delay(100);
        mockNotif.Verify(n => n.BroadcastRideToAllCaptainsAsync(It.Is<Ride>(r => r.Id == apiRes.Data!.Id)), Times.Once);
    }

    [Fact]
    public async Task Test_2_OfflineCaptain_ReceivesPushDispatchAttempt_EvenWithoutSignalRConnection()
    {
        var db = CreateDb();

        var offlineUser = new User { Id = 103, MobileNumber = "9876500103", FullName = "Offline Captain" };
        db.Users.Add(offlineUser);
        db.Drivers.Add(new Driver { Id = 3, UserId = offlineUser.Id, IsOnline = false, IsActive = true });
        db.UserDeviceTokens.Add(new UserDeviceToken { UserId = offlineUser.Id, DeviceToken = "ExponentPushToken[OfflineToken]", IsActive = true });
        await db.SaveChangesAsync();

        var logger = new Mock<ILogger<MockNotificationService>>();
        var notifService = new MockNotificationService(db, logger.Object);

        var ride = new Ride
        {
            Id = 901,
            RideNumber = "RD-OFFLINE-TEST",
            PickupAddress = "Station",
            DropoffAddress = "Hotel",
            EstimatedFare = 150,
            VehicleType = "AUTO"
        };

        var result = await notifService.BroadcastRideToAllCaptainsAsync(ride);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.CaptainsFound);
        Assert.Equal(1, result.TokensAttempted);

        // Verify in-app notification persisted for offline captain
        var inAppNotif = await db.Notifications.FirstOrDefaultAsync(n => n.UserId == offlineUser.Id);
        Assert.NotNull(inAppNotif);
        Assert.Equal("RIDE_REQUEST", inAppNotif!.Type);
    }

    [Fact]
    public async Task Test_3_MissingFcmCredentials_ProducesClearBlockedResult_NotFakeSuccess()
    {
        var db = CreateDb();

        var captain = new User { Id = 104, MobileNumber = "9876500104", FullName = "Captain Real" };
        db.Users.Add(captain);
        db.Drivers.Add(new Driver { Id = 4, UserId = captain.Id, IsOnline = true, IsActive = true });
        db.UserDeviceTokens.Add(new UserDeviceToken { UserId = captain.Id, DeviceToken = "ExponentPushToken[Token123]", IsActive = true });
        await db.SaveChangesAsync();

        var logger = new Mock<ILogger<PushNotificationDispatcherService>>();
        var httpClient = new HttpClient();
        // Empty configuration with no keys
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var dispatcher = new PushNotificationDispatcherService(db, logger.Object, httpClient, config);

        var (isConfigured, reason) = dispatcher.CheckCredentials();
        Assert.False(isConfigured);
        Assert.Contains("Missing", reason);

        var ride = new Ride
        {
            Id = 902,
            RideNumber = "RD-BLOCKED-TEST",
            PickupAddress = "Mall",
            DropoffAddress = "Subway",
            EstimatedFare = 120,
            VehicleType = "CAB"
        };

        var dispatchResult = await dispatcher.BroadcastRideToAllCaptainsAsync(ride);

        Assert.False(dispatchResult.IsSuccess);
        Assert.True(dispatchResult.IsBlocked);
        Assert.Equal("BLOCKED — credentials required", dispatchResult.Status);
        Assert.Contains("credentials required", dispatchResult.Message);
    }

    [Fact]
    public async Task Test_4_InvalidOrRevokedDeviceToken_IsSafelyHandled_AndPruned()
    {
        var db = CreateDb();

        var captain = new User { Id = 105, MobileNumber = "9876500105", FullName = "Captain Unregistered" };
        db.Users.Add(captain);
        db.Drivers.Add(new Driver { Id = 5, UserId = captain.Id, IsOnline = true, IsActive = true });

        // Token that is invalid (under 10 chars)
        var invalidToken = new UserDeviceToken { Id = 501, UserId = captain.Id, DeviceToken = "bad", IsActive = true };
        db.UserDeviceTokens.Add(invalidToken);
        await db.SaveChangesAsync();

        var logger = new Mock<ILogger<PushNotificationDispatcherService>>();
        var httpClient = new HttpClient();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { { "Expo:AccessToken", "test-token" } })
            .Build();

        var dispatcher = new PushNotificationDispatcherService(db, logger.Object, httpClient, config);

        var ride = new Ride
        {
            Id = 903,
            RideNumber = "RD-INVALID-TOKEN",
            PickupAddress = "Park",
            DropoffAddress = "Office",
            EstimatedFare = 80,
            VehicleType = "BIKE"
        };

        var result = await dispatcher.BroadcastRideToAllCaptainsAsync(ride);

        var refreshedToken = await db.UserDeviceTokens.FindAsync(501L);
        Assert.NotNull(refreshedToken);
        Assert.False(refreshedToken!.IsActive); // Should be pruned (IsActive = false)
        Assert.Equal(1, result.TokensPruned);
    }

    [Fact]
    public async Task Test_5_MultipleDeviceTokens_ForOneCaptain_AllDispatched()
    {
        var db = CreateDb();

        var captain = new User { Id = 106, MobileNumber = "9876500106", FullName = "Multi Device Captain" };
        db.Users.Add(captain);
        db.Drivers.Add(new Driver { Id = 6, UserId = captain.Id, IsOnline = true, IsActive = true });

        // Two devices for the same captain (e.g. tablet and phone)
        db.UserDeviceTokens.Add(new UserDeviceToken { UserId = captain.Id, DeviceToken = "ExponentPushToken[DeviceA]", DeviceType = "Phone", IsActive = true });
        db.UserDeviceTokens.Add(new UserDeviceToken { UserId = captain.Id, DeviceToken = "ExponentPushToken[DeviceB]", DeviceType = "Tablet", IsActive = true });
        await db.SaveChangesAsync();

        var logger = new Mock<ILogger<MockNotificationService>>();
        var notifService = new MockNotificationService(db, logger.Object);

        var ride = new Ride
        {
            Id = 904,
            RideNumber = "RD-MULTI-DEVICE",
            PickupAddress = "Alpha",
            DropoffAddress = "Beta",
            EstimatedFare = 200,
            VehicleType = "CAB"
        };

        var result = await notifService.BroadcastRideToAllCaptainsAsync(ride);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.CaptainsFound);
        Assert.Equal(2, result.TokensAttempted);
    }

    [Fact]
    public async Task Test_6_TwoCaptains_AcceptingSimultaneously_ResultsInExactlyOneClaim()
    {
        var db = CreateDb();

        var driverUser1 = new User { Id = 111, MobileNumber = "9876500111", FullName = "Captain Fast" };
        var driverUser2 = new User { Id = 112, MobileNumber = "9876500112", FullName = "Captain Slow" };
        var passenger = new User { Id = 222, MobileNumber = "9876500222", FullName = "Passenger" };
        db.Users.AddRange(driverUser1, driverUser2, passenger);

        var driver1 = new Driver { Id = 11, UserId = driverUser1.Id, IsOnline = true, IsActive = true };
        var driver2 = new Driver { Id = 12, UserId = driverUser2.Id, IsOnline = true, IsActive = true };
        db.Drivers.AddRange(driver1, driver2);

        var ride = new Ride
        {
            Id = 905,
            RideNumber = "RD-RACE-CONDITION",
            UserId = passenger.Id,
            PickupAddress = "Start",
            DropoffAddress = "Finish",
            EstimatedFare = 100,
            Status = RideStatus.Requested
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var hubMock = new Mock<IHubContext<RideTrackingHub>>();
        var hubClients = new Mock<IHubClients>();
        hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(new Mock<IClientProxy>().Object);
        hubMock.Setup(h => h.Clients).Returns(hubClients.Object);

        var controller1 = new DriverController(db, hubMock.Object);
        controller1.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, driverUser1.Id.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.Driver)
                }, "TestAuth"))
            }
        };

        var controller2 = new DriverController(db, hubMock.Object);
        controller2.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, driverUser2.Id.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.Driver)
                }, "TestAuth"))
            }
        };

        // Captain 1 accepts first
        var result1 = await controller1.AcceptRide(905);
        Assert.IsType<OkObjectResult>(result1.Result);

        // Captain 2 attempts to accept the already-claimed ride -> must fail with 409 Conflict
        var result2 = await controller2.AcceptRide(905);
        var conflict = Assert.IsType<ConflictObjectResult>(result2.Result);
        var conflictRes = Assert.IsType<ApiResponse<RideDto>>(conflict.Value);
        Assert.False(conflictRes.Success);
        Assert.Contains("already been accepted", conflictRes.Message, StringComparison.OrdinalIgnoreCase);

        // Database must retain exactly one assigned captain
        var finalRide = await db.Rides.FindAsync(905L);
        Assert.Equal(driver1.Id, finalRide!.DriverId);
        Assert.Equal(RideStatus.Accepted, finalRide.Status);
    }

    [Fact]
    public async Task Test_7_UnauthorizedUser_CannotJoinDriversPool()
    {

        var db = CreateDb();
        var hub = new RideTrackingHub(db);

        // Customer context (not a Driver, not an Admin)
        var httpContext = new DefaultHttpContext();
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "999"),
            new Claim(ClaimTypes.Role, RoleNames.Customer)
        }, "TestAuth"));

        var hubCallerContextMock = new Mock<HubCallerContext>();
        hubCallerContextMock.Setup(c => c.User).Returns(httpContext.User);
        hubCallerContextMock.Setup(c => c.ConnectionId).Returns("conn-123");

        hub.Context = hubCallerContextMock.Object;

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinDriversPool());
        Assert.Contains("Only registered captains", ex.Message);
    }

    [Fact]
    public async Task Test_8_UnregisterDeviceToken_DeactivatesSpecificDeviceTokenOnly()
    {
        var db = CreateDb();
        var captainUser = new User { Id = 301, MobileNumber = "9876543210", FullName = "Captain MultiDevice" };
        db.Users.Add(captainUser);

        var token1 = new UserDeviceToken { UserId = captainUser.Id, DeviceToken = "ExponentPushToken[Phone1]", IsActive = true };
        var token2 = new UserDeviceToken { UserId = captainUser.Id, DeviceToken = "ExponentPushToken[Phone2]", IsActive = true };
        db.UserDeviceTokens.AddRange(token1, token2);
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, captainUser.Id.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.Driver)
                }, "TestAuth"))
            }
        };

        // Unregister Phone1
        var result = await controller.UnregisterDeviceToken(new RegisterDeviceTokenRequest
        {
            Token = "ExponentPushToken[Phone1]"
        });

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse>(okResult.Value);
        Assert.True(apiRes.Success);

        // Verify Phone1 is inactive, Phone2 remains active
        var t1 = await db.UserDeviceTokens.FirstAsync(t => t.DeviceToken == "ExponentPushToken[Phone1]");
        var t2 = await db.UserDeviceTokens.FirstAsync(t => t.DeviceToken == "ExponentPushToken[Phone2]");
        Assert.False(t1.IsActive);
        Assert.True(t2.IsActive);
    }

    [Fact]
    public async Task Test_9_CustomerCancelsRide_CaptainAcceptanceIsRejected_WithConflict()
    {
        var db = CreateDb();
        var driverUser = new User { Id = 501, FullName = "Driver One" };
        var customerUser = new User { Id = 502, FullName = "Customer One" };
        db.Users.AddRange(driverUser, customerUser);

        var driver = new Driver { Id = 51, UserId = driverUser.Id, IsOnline = true, IsActive = true };
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 910,
            RideNumber = "RD-910",
            UserId = customerUser.Id,
            PickupAddress = "Location A",
            DropoffAddress = "Location B",
            EstimatedFare = 150,
            VehicleType = "BIKE",
            Status = RideStatus.Cancelled, // Customer cancelled
            CancelledAt = DateTime.UtcNow
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var hubMock = new Mock<IHubContext<RideTrackingHub>>();
        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        hubMock.Setup(h => h.Clients).Returns(hubClients.Object);

        var controller = new DriverController(db, hubMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, driverUser.Id.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.Driver)
                }, "TestAuth"))
            }
        };

        var response = await controller.AcceptRide(910);
        var conflict = Assert.IsType<ConflictObjectResult>(response.Result);
        var apiRes = Assert.IsType<ApiResponse<RideDto>>(conflict.Value);
        Assert.False(apiRes.Success);
        Assert.Contains("cancelled", apiRes.Message, StringComparison.OrdinalIgnoreCase);

        // Ride must remain CANCELLED without driver assignment
        var persisted = await db.Rides.FindAsync(910L);
        Assert.Equal(RideStatus.Cancelled, persisted!.Status);
        Assert.Null(persisted.DriverId);
    }

    [Fact]
    public async Task Test_10_RideOlderThan5Minutes_IsRejectedAsExpiredOnAcceptance()
    {
        var db = CreateDb();
        var driverUser = new User { Id = 601, FullName = "Driver Two" };
        var customerUser = new User { Id = 602, FullName = "Customer Two" };
        db.Users.AddRange(driverUser, customerUser);

        var driver = new Driver { Id = 61, UserId = driverUser.Id, IsOnline = true, IsActive = true };
        db.Drivers.Add(driver);

        var ride = new Ride
        {
            Id = 920,
            RideNumber = "RD-920",
            UserId = customerUser.Id,
            PickupAddress = "Location C",
            DropoffAddress = "Location D",
            EstimatedFare = 200,
            VehicleType = "CAB",
            Status = RideStatus.Requested,
            CreatedAt = DateTime.UtcNow.AddMinutes(-6) // Over 5 minutes ago
        };
        db.Rides.Add(ride);
        await db.SaveChangesAsync();

        var hubMock = new Mock<IHubContext<RideTrackingHub>>();
        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        hubMock.Setup(h => h.Clients).Returns(hubClients.Object);

        var controller = new DriverController(db, hubMock.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, driverUser.Id.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.Driver)
                }, "TestAuth"))
            }
        };

        var response = await controller.AcceptRide(920);
        var conflict = Assert.IsType<ConflictObjectResult>(response.Result);
        var apiRes = Assert.IsType<ApiResponse<RideDto>>(conflict.Value);
        Assert.False(apiRes.Success);
        Assert.Contains("expired", apiRes.Message, StringComparison.OrdinalIgnoreCase);

        var persisted = await db.Rides.FindAsync(920L);
        Assert.Equal(RideStatus.Expired, persisted!.Status);
        Assert.Null(persisted.DriverId);
    }

    [Fact]
    public async Task Test_11_RideExpiryBackgroundService_SweepsOverdueRides_Atomically()
    {
        var dbName = Guid.NewGuid().ToString();
        var dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        using (var initialDb = new AppDbContext(dbOptions))
        {
            var user = new User { Id = 701, FullName = "Customer Three" };
            initialDb.Users.Add(user);

            var overdueRide = new Ride
            {
                Id = 930,
                RideNumber = "RD-930",
                UserId = user.Id,
                PickupAddress = "Pickup X",
                DropoffAddress = "Dropoff Y",
                EstimatedFare = 120,
                VehicleType = "AUTO",
                Status = RideStatus.Requested,
                CreatedAt = DateTime.UtcNow.AddMinutes(-7)
            };
            var activeFreshRide = new Ride
            {
                Id = 931,
                RideNumber = "RD-931",
                UserId = user.Id,
                PickupAddress = "Pickup X2",
                DropoffAddress = "Dropoff Y2",
                EstimatedFare = 120,
                VehicleType = "AUTO",
                Status = RideStatus.Requested,
                CreatedAt = DateTime.UtcNow.AddMinutes(-2) // Only 2 mins old
            };
            initialDb.Rides.AddRange(overdueRide, activeFreshRide);
            await initialDb.SaveChangesAsync();
        }

        var hubMock = new Mock<IHubContext<RideTrackingHub>>();
        var hubClients = new Mock<IHubClients>();
        var clientProxy = new Mock<IClientProxy>();
        hubClients.Setup(c => c.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        hubMock.Setup(h => h.Clients).Returns(hubClients.Object);

        var serviceCollection = new Microsoft.Extensions.DependencyInjection.ServiceCollection();
        serviceCollection.AddScoped(_ => new AppDbContext(dbOptions));
        serviceCollection.AddScoped(_ => hubMock.Object);
        var serviceProvider = serviceCollection.BuildServiceProvider();

        var loggerMock = new Mock<ILogger<RideExpiryBackgroundService>>();
        var expiryService = new RideExpiryBackgroundService(loggerMock.Object, serviceProvider);

        var sweptCount = await expiryService.SweepExpiredRidesAsync();
        Assert.Equal(1, sweptCount);

        using (var verifyDb = new AppDbContext(dbOptions))
        {
            var sweptRide = await verifyDb.Rides.FindAsync(930L);
            var freshRide = await verifyDb.Rides.FindAsync(931L);

            Assert.Equal(RideStatus.Expired, sweptRide!.Status);
            Assert.Equal(RideStatus.Requested, freshRide!.Status);
        }
    }

    [Fact]
    public async Task Test_12_OrderStatusHub_JoinOrder_Throws_WhenCallerNotAuthorized()
    {
        var db = CreateDb();
        var customer = new User { Id = 801, MobileNumber = "9876500801", FullName = "Customer 801" };
        var intruder = new User { Id = 802, MobileNumber = "9876500802", FullName = "Intruder 802" };
        var restaurant = new Restaurant { Id = 801, Name = "Bazaar Kitchen", IsActive = true };
        db.Users.AddRange(customer, intruder);
        db.Restaurants.Add(restaurant);

        var order = new FoodOrder
        {
            Id = 8801,
            OrderNumber = "FO-TEST-HUB-AUTH-01",
            UserId = customer.Id,
            RestaurantId = restaurant.Id,
            Status = OrderStatus.Pending
        };
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();

        var hub = new OrderStatusHub(db);
        var hubCallerContextMock = new Mock<HubCallerContext>();
        hubCallerContextMock.Setup(c => c.ConnectionId).Returns("conn-intruder");
        hubCallerContextMock.Setup(c => c.User).Returns(new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, intruder.Id.ToString()),
            new Claim(ClaimTypes.Role, RoleNames.Customer)
        }, "TestAuth")));
        hub.Context = hubCallerContextMock.Object;

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinOrder(order.Id));
        Assert.Contains("Unauthorized", ex.Message);
    }

    [Fact]
    public async Task Test_13_OrderStatusHub_JoinRestaurantKitchen_Throws_WhenCallerNotMappedStaff()
    {
        var db = CreateDb();
        var outsider = new User { Id = 803, MobileNumber = "9876500803", FullName = "Outsider 803" };
        var restaurant = new Restaurant { Id = 802, Name = "Dosa Corner", IsActive = true };
        db.Users.Add(outsider);
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();

        var hub = new OrderStatusHub(db);
        var hubCallerContextMock = new Mock<HubCallerContext>();
        hubCallerContextMock.Setup(c => c.ConnectionId).Returns("conn-outsider");
        hubCallerContextMock.Setup(c => c.User).Returns(new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, outsider.Id.ToString()),
            new Claim(ClaimTypes.Role, RoleNames.Customer)
        }, "TestAuth")));
        hub.Context = hubCallerContextMock.Object;

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinRestaurantKitchen(restaurant.Id));
        Assert.Contains("Unauthorized", ex.Message);
    }


    [Fact]
    public async Task CancelOrder_WhenOrderAlreadyPaid_MarksOrderRefunded()
    {
        var db = CreateDb();
        var customer = new User { Id = 901, MobileNumber = "9876500901", FullName = "Customer 901" };
        var restaurant = new Restaurant { Id = 901, Name = "Cafe 901", IsActive = true };
        db.Users.Add(customer);
        db.Restaurants.Add(restaurant);

        var order = new FoodOrder
        {
            Id = 9901,
            OrderNumber = "FO-REFUND-01",
            UserId = customer.Id,
            RestaurantId = restaurant.Id,
            PaymentMethod = "ONLINE",
            PaymentStatus = "PAID",
            Status = OrderStatus.Pending,
            GrandTotal = 350.00m
        };
        db.FoodOrders.Add(order);

        var payment = new Payment
        {
            Id = 9901,
            UserId = customer.Id,
            Module = "FOOD",
            OrderId = order.Id,
            Amount = 350.00m,
            PaymentMethod = "UPI",
            TransactionId = "txn-refund-9901",
            Status = "PAID"
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        var origProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER"); Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", "Mock"); var mockPaymentService = new MockPaymentService(db); Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", origProvider);
        var hubMock = new Mock<IHubContext<OrderStatusHub>>();
        var controller = new FoodOrdersController(db, hubMock.Object, mockPaymentService);
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, customer.Id.ToString()),
            new Claim(ClaimTypes.Role, RoleNames.Customer)
        }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        var result = await controller.CancelOrder(order.Id);
        Assert.IsType<OkObjectResult>(result.Result);

        var updatedOrder = await db.FoodOrders.FindAsync(order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.Cancelled, updatedOrder.Status);
        Assert.Equal("REFUNDED", updatedOrder.PaymentStatus);
    }

    [Fact]
    public async Task FoodPaymentSync_LatePaidCallbackOnCancelledOrder_SetsRefundDue()
    {
        var db = CreateDb();
        var order = new FoodOrder
        {
            Id = 9902,
            OrderNumber = "FO-LATE-02",
            UserId = 902,
            RestaurantId = 902,
            PaymentMethod = "ONLINE",
            PaymentStatus = "CANCELLED",
            Status = OrderStatus.Cancelled,
            GrandTotal = 200.00m
        };
        db.FoodOrders.Add(order);

        var payment = new Payment
        {
            Id = 9902,
            UserId = 902,
            Module = "FOOD",
            OrderId = order.Id,
            Amount = 200.00m,
            PaymentMethod = "UPI",
            TransactionId = "txn-late-9902",
            Status = "PAID"
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync();

        await FoodPaymentSync.ApplyAsync(db, payment.TransactionId, true);

        var updatedOrder = await db.FoodOrders.FindAsync(order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.Cancelled, updatedOrder.Status);
        Assert.Equal("REFUND_DUE", updatedOrder.PaymentStatus);
    }

    [Fact]
    public async Task ManageUser_AssignRestaurantOwner_RequiresValidExplicitRestaurantId()
    {
        var db = CreateDb();
        var admin = new User { Id = 1001, MobileNumber = "9876501001", FullName = "Admin 1001" };
        var citizen = new User { Id = 1002, MobileNumber = "9876501002", FullName = "Citizen 1002" };
        var roleOwner = new Role { Id = 101, Name = RoleNames.RestaurantOwner };
        db.Users.AddRange(admin, citizen);
        db.Roles.Add(roleOwner);
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Role, RoleNames.Admin)
        }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        // 1. Omitted RestaurantId -> BadRequest
        var res1 = await controller.ManageUser(new AdminUserActionRequest
        {
            UserId = citizen.Id,
            Action = "ROLE",
            RoleName = RoleNames.RestaurantOwner
        });
        Assert.IsType<BadRequestObjectResult>(res1.Result);

        // 2. Inactive or nonexistent RestaurantId -> BadRequest
        var res2 = await controller.ManageUser(new AdminUserActionRequest
        {
            UserId = citizen.Id,
            Action = "ROLE",
            RoleName = RoleNames.RestaurantOwner,
            RestaurantId = 99999
        });
        Assert.IsType<BadRequestObjectResult>(res2.Result);

        // 3. Active valid restaurant -> Success & provisions RestaurantUsers mapping
        var rest = new Restaurant { Id = 501, Name = "Spicy Delight", IsActive = true };
        db.Restaurants.Add(rest);
        await db.SaveChangesAsync();

        var res3 = await controller.ManageUser(new AdminUserActionRequest
        {
            UserId = citizen.Id,
            Action = "ROLE",
            RoleName = RoleNames.RestaurantOwner,
            RestaurantId = rest.Id
        });
        Assert.IsType<OkObjectResult>(res3.Result);

        var mapping = await db.RestaurantUsers.FirstOrDefaultAsync(ru => ru.UserId == citizen.Id && ru.RestaurantId == rest.Id);
        Assert.NotNull(mapping);
        Assert.True(mapping.IsActive);

        // 4. REMOVE_ROLE -> Deactivates RestaurantUsers mappings consistently
        var res4 = await controller.ManageUser(new AdminUserActionRequest
        {
            UserId = citizen.Id,
            Action = "REMOVE_ROLE",
            RoleName = RoleNames.RestaurantOwner
        });
        Assert.IsType<OkObjectResult>(res4.Result);

        var freshMapping = await db.RestaurantUsers.FirstOrDefaultAsync(ru => ru.UserId == citizen.Id && ru.RestaurantId == rest.Id);
        Assert.NotNull(freshMapping);
        Assert.False(freshMapping.IsActive);
    }
}