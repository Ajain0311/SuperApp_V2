using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Hubs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class FoodDeliveryAndPaymentTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static DriverController DriverApi(AppDbContext db, long userId, string role)
    {
        var controller = new DriverController(db, new FakeHubContext());
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    private static async Task<(User customer, Restaurant restaurant, FoodOrder order, Driver a, Driver b)> SeedReadyOrder(AppDbContext db)
    {
        var customer = new User { Id = 1, MobileNumber = "9000000001", FullName = "Customer" };
        var userA = new User { Id = 2, MobileNumber = "9000000002", FullName = "Captain A" };
        var userB = new User { Id = 3, MobileNumber = "9000000003", FullName = "Captain B" };
        var owner = new User { Id = 4, MobileNumber = "9000000004", FullName = "Owner" };
        var restaurant = new Restaurant { Id = 10, Name = "Test Kitchen", IsActive = true, City = "Indore" };
        db.Users.AddRange(customer, userA, userB, owner);
        db.Restaurants.Add(restaurant);
        var a = new Driver { Id = 21, UserId = 2, IsActive = true, IsOnline = true, LicenseNumber = "A" };
        var b = new Driver { Id = 22, UserId = 3, IsActive = true, IsOnline = true, LicenseNumber = "B" };
        db.Drivers.AddRange(a, b);
        var order = new FoodOrder
        {
            Id = 50,
            OrderNumber = "FO-TESTDELIVERY01",
            UserId = customer.Id,
            RestaurantId = restaurant.Id,
            Status = OrderStatus.Ready,
            PaymentMethod = "COD",
            PaymentStatus = "PENDING",
            GrandTotal = 120,
            SubTotal = 100,
            CreatedAt = DateTime.UtcNow
        };
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();
        return (customer, restaurant, order, a, b);
    }

    [Fact]
    public async Task ConcurrentCaptains_OnlyOneAccepts()
    {
        var db = NewDb();
        var seeded = await SeedReadyOrder(db);
        var captainA = DriverApi(db, seeded.a.UserId, RoleNames.Driver);
        var captainB = DriverApi(db, seeded.b.UserId, RoleNames.Driver);

        var results = await Task.WhenAll(
            captainA.AcceptFoodOrder(seeded.order.Id),
            captainB.AcceptFoodOrder(seeded.order.Id));

        var successes = results.Count(r => r.Result is OkObjectResult);
        var conflicts = results.Count(r => r.Result is ConflictObjectResult);
        Assert.Equal(1, successes);
        Assert.Equal(1, conflicts);

        var stored = await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == seeded.order.Id);
        Assert.NotNull(stored.DriverId);
        Assert.Contains(stored.DriverId, new long?[] { seeded.a.Id, seeded.b.Id });
        Assert.Equal(1, await db.FoodOrders.CountAsync(o => o.Id == seeded.order.Id && o.DriverId != null));
    }

    [Fact]
    public async Task OfflineCustomerAndStranger_CannotTakeDelivery()
    {
        var db = NewDb();
        var seeded = await SeedReadyOrder(db);
        seeded.a.IsOnline = false;
        await db.SaveChangesAsync();

        var offline = await DriverApi(db, seeded.a.UserId, RoleNames.Driver).AcceptFoodOrder(seeded.order.Id);
        Assert.IsType<ConflictObjectResult>(offline.Result);

        var customer = await DriverApi(db, seeded.customer.Id, RoleNames.Customer).AcceptFoodOrder(seeded.order.Id);
        Assert.IsType<ForbidResult>(customer.Result);

        var owner = await DriverApi(db, 4, RoleNames.RestaurantOwner).AcceptFoodOrder(seeded.order.Id);
        Assert.IsType<ForbidResult>(owner.Result);

        var stored = await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == seeded.order.Id);
        Assert.Null(stored.DriverId);
    }

    [Fact]
    public async Task OtherCaptain_CannotPickupOrDeliver()
    {
        var db = NewDb();
        var seeded = await SeedReadyOrder(db);
        var accepted = await DriverApi(db, seeded.a.UserId, RoleNames.Driver).AcceptFoodOrder(seeded.order.Id);
        Assert.IsType<OkObjectResult>(accepted.Result);

        var pickup = await DriverApi(db, seeded.b.UserId, RoleNames.Driver).PickupFoodOrder(seeded.order.Id);
        Assert.IsType<ForbidResult>(pickup.Result);

        var deliver = await DriverApi(db, seeded.b.UserId, RoleNames.Driver).DeliverFoodOrder(seeded.order.Id);
        Assert.IsType<ForbidResult>(deliver.Result);

        var mine = await DriverApi(db, seeded.a.UserId, RoleNames.Driver).PickupFoodOrder(seeded.order.Id);
        Assert.IsType<OkObjectResult>(mine.Result);
        var done = await DriverApi(db, seeded.a.UserId, RoleNames.Driver).DeliverFoodOrder(seeded.order.Id);
        Assert.IsType<OkObjectResult>(done.Result);

        var stored = await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == seeded.order.Id);
        Assert.Equal(OrderStatus.Delivered, stored.Status);
        Assert.Equal("PAID", stored.PaymentStatus);
        Assert.Equal(seeded.a.Id, stored.DriverId);
    }

    [Fact]
    public async Task UnverifiedOrFailedPayment_DoesNotMarkOrderPaid_AndSuccessIsIdempotent()
    {
        var db = NewDb();
        var user = new User { Id = 8, MobileNumber = "9000000008", FullName = "Payer" };
        db.Users.Add(user);
        db.Restaurants.Add(new Restaurant { Id = 3, Name = "Pay Kitchen", IsActive = true });
        var order = new FoodOrder
        {
            Id = 80,
            OrderNumber = "FO-PAYTEST0000001",
            UserId = 8,
            RestaurantId = 3,
            Status = OrderStatus.Pending,
            PaymentMethod = "ONLINE",
            PaymentStatus = "PENDING_PAYMENT",
            GrandTotal = 200,
            CreatedAt = DateTime.UtcNow
        };
        db.FoodOrders.Add(order);
        db.Payments.Add(new Payment
        {
            UserId = 8,
            Module = "FOOD",
            OrderId = 80,
            Amount = 200,
            PaymentMethod = "EASEBUZZ",
            TransactionId = "txn-food-1",
            Status = "PENDING"
        });
        await db.SaveChangesAsync();

        await FoodPaymentSync.ApplyAsync(db, "txn-food-1", verified: false);
        Assert.Equal("PENDING_PAYMENT", (await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == 80)).PaymentStatus);

        var payment = await db.Payments.SingleAsync(p => p.TransactionId == "txn-food-1");
        payment.Status = "FAILED";
        await db.SaveChangesAsync();
        await FoodPaymentSync.ApplyAsync(db, "txn-food-1", verified: false);
        Assert.Equal("FAILED", (await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == 80)).PaymentStatus);

        payment = await db.Payments.SingleAsync(p => p.TransactionId == "txn-food-1");
        payment.Status = "PAID";
        var failedOrder = await db.FoodOrders.SingleAsync(o => o.Id == 80);
        failedOrder.PaymentStatus = "PENDING_PAYMENT";
        await db.SaveChangesAsync();

        await FoodPaymentSync.ApplyAsync(db, "txn-food-1", verified: true);
        await FoodPaymentSync.ApplyAsync(db, "txn-food-1", verified: true);
        var paid = await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == 80);
        Assert.Equal("PAID", paid.PaymentStatus);
        Assert.Equal(OrderStatus.Pending, paid.Status);
        Assert.Equal(1, await db.FoodOrders.CountAsync(o => o.Id == 80));
    }

    [Fact]
    public async Task PaymentsController_MockComplete_IsBlockedInProduction()
    {
        var db = NewDb();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var controller = new SuperApp.API.Controllers.PaymentsController(
            new MockPaymentService(db), db, config);

        var origEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");

            var request = new SuperApp.API.DTOs.MockCompletePaymentRequest { TransactionId = "test", Success = true };
            var result = await controller.MockComplete(request);

            var objResult = Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result.Result);
            Assert.Equal(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden, objResult.StatusCode);
            var response = Assert.IsType<SuperApp.API.DTOs.ApiResponse<SuperApp.API.Services.PaymentVerificationResult>>(objResult.Value);
            Assert.Contains("forbidden", response.Message, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", origEnv);
        }
    }

    [Fact]
    public async Task PaymentsController_MockComplete_Returns403_WhenPaymentProviderNotMock()
    {
        var db = NewDb();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var controller = new SuperApp.API.Controllers.PaymentsController(
            new MockPaymentService(db), db, config);

        var origProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER");
        var origEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", "Easebuzz");

            var request = new SuperApp.API.DTOs.MockCompletePaymentRequest { TransactionId = "test", Success = true };
            var result = await controller.MockComplete(request);

            var objResult = Assert.IsType<Microsoft.AspNetCore.Mvc.ObjectResult>(result.Result);
            Assert.Equal(Microsoft.AspNetCore.Http.StatusCodes.Status403Forbidden, objResult.StatusCode);
            var response = Assert.IsType<SuperApp.API.DTOs.ApiResponse<SuperApp.API.Services.PaymentVerificationResult>>(objResult.Value);
            Assert.Contains("forbidden", response.Message, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", origProvider);
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", origEnv);
        }
    }
}
