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

    [Fact]
    public void EasebuzzHash_InitiateAndReverse_CalculateAccurateSha512()
    {
        var key = "2PBP7CABXZ";
        var salt = "DAH88E3UWQ";
        var txnid = "txnid12345";
        var amount = "100.00";
        var product = "FOOD";
        var firstname = "TestUser";
        var email = "test@superapp.local";

        var initiateHash = EasebuzzHash.InitiatePayment(
            key, txnid, amount, product, firstname, email, "", "", "", "", "", salt);
        Assert.NotNull(initiateHash);
        Assert.Equal(128, initiateHash.Length);

        var reverseHash = EasebuzzHash.Reverse(
            salt, "success", "", "", "", "", "", "", "", "", "", "",
            email, firstname, product, amount, txnid, key);
        Assert.NotNull(reverseHash);
        Assert.Equal(128, reverseHash.Length);

        // Verify invalid hash fails comparison
        var tamperedAmountHash = EasebuzzHash.Reverse(
            salt, "success", "", "", "", "", "", "", "", "", "", "",
            email, firstname, product, "50.00", txnid, key);
        Assert.NotEqual(reverseHash, tamperedAmountHash);
    }

    [Fact]
    public async Task EasebuzzWebhook_WithValidHash_MarksPaymentPaidIdempotently()
    {
        var db = NewDb();
        var key = "TESTKEY123";
        var salt = "TESTSALT456";

        var origKey = Environment.GetEnvironmentVariable("PAYMENT_KEY");
        var origSalt = Environment.GetEnvironmentVariable("PAYMENT_SECRET");
        var origEnv = Environment.GetEnvironmentVariable("PAYMENT_ENV");
        var origProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER");

        try
        {
            Environment.SetEnvironmentVariable("PAYMENT_KEY", key);
            Environment.SetEnvironmentVariable("PAYMENT_SECRET", salt);
            Environment.SetEnvironmentVariable("PAYMENT_ENV", "test");
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", "Easebuzz");

            var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
            var httpClient = new HttpClient();
            var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<EasebuzzPaymentService>.Instance;
            var easebuzzService = new EasebuzzPaymentService(httpClient, db, config, logger);
            var controller = new SuperApp.API.Controllers.PaymentsController(easebuzzService, db, config);

            var user = new User { Id = 91, FullName = "Webhook Tester", MobileNumber = "9876543210", Email = "webhook@test.com" };
            db.Users.Add(user);
            var restaurant = new Restaurant { Id = 91, Name = "Webhook Diner", IsActive = true };
            db.Restaurants.Add(restaurant);
            var order = new FoodOrder
            {
                Id = 910,
                OrderNumber = "FO-WH0001",
                UserId = 91,
                RestaurantId = 91,
                Status = OrderStatus.Pending,
                PaymentMethod = "ONLINE",
                PaymentStatus = "PENDING_PAYMENT",
                GrandTotal = 150.00m,
                CreatedAt = DateTime.UtcNow
            };
            db.FoodOrders.Add(order);

            var txnid = "txn-webhook-910";
            var amountStr = "150.00";
            var payment = new Payment
            {
                UserId = 91,
                Module = "FOOD",
                OrderId = 910,
                Amount = 150.00m,
                PaymentMethod = "EASEBUZZ",
                TransactionId = txnid,
                Status = "PENDING",
                CreatedAt = DateTime.UtcNow
            };
            db.Payments.Add(payment);
            await db.SaveChangesAsync();

            var validHash = EasebuzzHash.Reverse(
                salt, "success", "", "", "", "", "", "", "", "", "", "",
                "webhook@test.com", "Webhook Tester", "FOOD", amountStr, txnid, key);

            var formDict = new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>
            {
                ["txnid"] = txnid,
                ["status"] = "success",
                ["amount"] = amountStr,
                ["productinfo"] = "FOOD",
                ["firstname"] = "Webhook Tester",
                ["email"] = "webhook@test.com",
                ["key"] = key,
                ["hash"] = validHash
            };

            var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
            httpContext.Request.ContentType = "application/x-www-form-urlencoded";
            httpContext.Request.Form = new Microsoft.AspNetCore.Http.FormCollection(formDict);
            controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = httpContext };

            // 1. First webhook call -> should succeed and mark PAID
            var result1 = await controller.Webhook();
            Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result1);

            var storedPayment = await db.Payments.AsNoTracking().SingleAsync(p => p.TransactionId == txnid);
            var storedOrder = await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == 910);
            Assert.Equal("PAID", storedPayment.Status);
            Assert.Equal("PAID", storedOrder.PaymentStatus);

            // 2. Duplicate webhook call -> must be idempotent without error
            var result2 = await controller.Webhook();
            Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result2);

            var countPayments = await db.Payments.CountAsync(p => p.TransactionId == txnid);
            Assert.Equal(1, countPayments);
        }
        finally
        {
            Environment.SetEnvironmentVariable("PAYMENT_KEY", origKey);
            Environment.SetEnvironmentVariable("PAYMENT_SECRET", origSalt);
            Environment.SetEnvironmentVariable("PAYMENT_ENV", origEnv);
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", origProvider);
        }
    }

    [Fact]
    public async Task EasebuzzWebhook_WithTamperedHash_RejectsUnauthorized()
    {
        var db = NewDb();
        var key = "TESTKEY123";
        var salt = "TESTSALT456";

        var origKey = Environment.GetEnvironmentVariable("PAYMENT_KEY");
        var origSalt = Environment.GetEnvironmentVariable("PAYMENT_SECRET");
        var origProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER");

        try
        {
            Environment.SetEnvironmentVariable("PAYMENT_KEY", key);
            Environment.SetEnvironmentVariable("PAYMENT_SECRET", salt);
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", "Easebuzz");

            var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
            var httpClient = new HttpClient();
            var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<EasebuzzPaymentService>.Instance;
            var easebuzzService = new EasebuzzPaymentService(httpClient, db, config, logger);
            var controller = new SuperApp.API.Controllers.PaymentsController(easebuzzService, db, config);

            var formDict = new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>
            {
                ["txnid"] = "txn-tampered-1",
                ["status"] = "success",
                ["amount"] = "500.00",
                ["hash"] = "invalid_tampered_hash_value"
            };

            var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
            httpContext.Request.ContentType = "application/x-www-form-urlencoded";
            httpContext.Request.Form = new Microsoft.AspNetCore.Http.FormCollection(formDict);
            controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = httpContext };

            var result = await controller.Webhook();
            Assert.IsType<Microsoft.AspNetCore.Mvc.UnauthorizedResult>(result);
        }
        finally
        {
            Environment.SetEnvironmentVariable("PAYMENT_KEY", origKey);
            Environment.SetEnvironmentVariable("PAYMENT_SECRET", origSalt);
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", origProvider);
        }
    }

    [Fact]
    public async Task EasebuzzWebhook_FailureOrCancellation_TransitionsStatusCorrectly()
    {
        var db = NewDb();
        var key = "TESTKEY123";
        var salt = "TESTSALT456";

        var origKey = Environment.GetEnvironmentVariable("PAYMENT_KEY");
        var origSalt = Environment.GetEnvironmentVariable("PAYMENT_SECRET");
        var origProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER");

        try
        {
            Environment.SetEnvironmentVariable("PAYMENT_KEY", key);
            Environment.SetEnvironmentVariable("PAYMENT_SECRET", salt);
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", "Easebuzz");

            var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
            var httpClient = new HttpClient();
            var logger = Microsoft.Extensions.Logging.Abstractions.NullLogger<EasebuzzPaymentService>.Instance;
            var easebuzzService = new EasebuzzPaymentService(httpClient, db, config, logger);
            var controller = new SuperApp.API.Controllers.PaymentsController(easebuzzService, db, config);

            var payment = new Payment
            {
                UserId = 1,
                Module = "FOOD",
                OrderId = 920,
                Amount = 100.00m,
                PaymentMethod = "EASEBUZZ",
                TransactionId = "txn-fail-920",
                Status = "PENDING"
            };
            db.Payments.Add(payment);
            db.FoodOrders.Add(new FoodOrder
            {
                Id = 920,
                OrderNumber = "FO-FAIL001",
                UserId = 1,
                RestaurantId = 1,
                PaymentMethod = "ONLINE",
                PaymentStatus = "PENDING_PAYMENT",
                Status = OrderStatus.Pending
            });
            await db.SaveChangesAsync();

            var failHash = EasebuzzHash.Reverse(
                salt, "failure", "", "", "", "", "", "", "", "", "", "",
                "user@test.com", "User", "FOOD", "100.00", "txn-fail-920", key);

            var formDict = new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>
            {
                ["txnid"] = "txn-fail-920",
                ["status"] = "failure",
                ["amount"] = "100.00",
                ["productinfo"] = "FOOD",
                ["firstname"] = "User",
                ["email"] = "user@test.com",
                ["key"] = key,
                ["hash"] = failHash
            };

            var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
            httpContext.Request.ContentType = "application/x-www-form-urlencoded";
            httpContext.Request.Form = new Microsoft.AspNetCore.Http.FormCollection(formDict);
            controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = httpContext };

            var result = await controller.Webhook();
            Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result);

            var updatedPayment = await db.Payments.AsNoTracking().SingleAsync(p => p.TransactionId == "txn-fail-920");
            var updatedOrder = await db.FoodOrders.AsNoTracking().SingleAsync(o => o.Id == 920);
            Assert.Equal("FAILED", updatedPayment.Status);
            Assert.Equal("FAILED", updatedOrder.PaymentStatus);
        }
        finally
        {
            Environment.SetEnvironmentVariable("PAYMENT_KEY", origKey);
            Environment.SetEnvironmentVariable("PAYMENT_SECRET", origSalt);
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", origProvider);
        }
    }

    [Fact]
    public async Task CreateOrder_WithoutAuth_ReturnsUnauthorized()
    {
        var db = NewDb();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var controller = new SuperApp.API.Controllers.PaymentsController(new MockPaymentService(db), db, config);
        // DefaultHttpContext with no User claims
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.CreateOrder(new CreatePaymentRequest
        {
            Module = "FOOD",
            ReceiptId = "50",
            Amount = 100
        });

        var unauth = Assert.IsType<UnauthorizedObjectResult>(result.Result);
        var resp = Assert.IsType<ApiResponse<PaymentOrderResult>>(unauth.Value);
        Assert.False(resp.Success);
    }

    [Fact]
    public async Task CreateOrder_BelongingToAnotherUser_ReturnsForbid()
    {
        var db = NewDb();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var controller = new SuperApp.API.Controllers.PaymentsController(new MockPaymentService(db), db, config);

        // Order owned by User 1
        db.FoodOrders.Add(new FoodOrder
        {
            Id = 55,
            OrderNumber = "FO-OWN55",
            UserId = 1,
            RestaurantId = 1,
            PaymentMethod = "ONLINE",
            PaymentStatus = "PENDING_PAYMENT",
            GrandTotal = 250,
            Status = OrderStatus.Pending
        });
        await db.SaveChangesAsync();

        // Calling as User 2 (not admin)
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "2"),
            new Claim(ClaimTypes.Role, RoleNames.Customer)
        }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        var result = await controller.CreateOrder(new CreatePaymentRequest
        {
            Module = "FOOD",
            ReceiptId = "55",
            Amount = 250
        });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task VerifyPayment_WithoutAuth_ReturnsUnauthorized()
    {
        var db = NewDb();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var controller = new SuperApp.API.Controllers.PaymentsController(new MockPaymentService(db), db, config);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.VerifyPayment(new VerifyPaymentRequest
        {
            TransactionId = "txn-12345"
        });

        var unauth = Assert.IsType<UnauthorizedObjectResult>(result.Result);
        var resp = Assert.IsType<ApiResponse<PaymentVerificationResult>>(unauth.Value);
        Assert.False(resp.Success);
    }

    [Fact]
    public async Task VerifyPayment_BelongingToAnotherUser_ReturnsForbid()
    {
        var db = NewDb();
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var controller = new SuperApp.API.Controllers.PaymentsController(new MockPaymentService(db), db, config);

        // Payment owned by User 1
        db.Payments.Add(new Payment
        {
            Id = 101,
            UserId = 1,
            Module = "FOOD",
            OrderId = 55,
            Amount = 250,
            PaymentMethod = "UPI",
            TransactionId = "txn-secret-101",
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // Calling as User 2 (not admin)
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "2"),
            new Claim(ClaimTypes.Role, RoleNames.Customer)
        }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        var result = await controller.VerifyPayment(new VerifyPaymentRequest
        {
            TransactionId = "txn-secret-101"
        });

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public void MockPaymentService_InProduction_ThrowsException()
    {
        var origEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var origProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", "Mock");

            var db = NewDb();
            Assert.Throws<InvalidOperationException>(() => new MockPaymentService(db));
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", origEnv);
            Environment.SetEnvironmentVariable("PAYMENT_PROVIDER", origProvider);
        }
    }

    [Fact]
    public async Task MockPaymentService_VerifyPayment_NonExistentTxn_FailsClosed()
    {
        var db = NewDb();
        var service = new MockPaymentService(db);
        var result = await service.VerifyPaymentAsync("non-existent-txn-id", "", "");

        Assert.False(result.IsVerified);
        Assert.Equal("FAILED", result.Status);
        Assert.Contains("not found", result.Message, StringComparison.OrdinalIgnoreCase);
    }
}
