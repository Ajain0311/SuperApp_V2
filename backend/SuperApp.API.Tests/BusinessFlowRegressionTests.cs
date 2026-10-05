using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Moq;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Hubs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class BusinessFlowRegressionTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static VendorController Vendor(AppDbContext db, long userId)
    {
        var clients = new Mock<IHubClients>();
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(new Mock<IClientProxy>().Object);
        var hub = new Mock<IHubContext<OrderStatusHub>>();
        hub.Setup(h => h.Clients).Returns(clients.Object);
        var controller = new VendorController(db, hub.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                    new Claim(ClaimTypes.Role, RoleNames.RestaurantOwner)
                }, "TestAuth"))
            }
        };
        return controller;
    }

    private static async Task<FoodOrder> PendingOrder(AppDbContext db, string method, string paymentStatus)
    {
        db.Users.Add(new User { Id = 1, MobileNumber = "9000001111", FullName = "Owner" });
        db.Restaurants.Add(new Restaurant { Id = 9, Name = "Kitchen", IsActive = true });
        db.RestaurantUsers.Add(new RestaurantUser { UserId = 1, RestaurantId = 9, IsActive = true });
        var order = new FoodOrder
        {
            Id = 41,
            OrderNumber = "FO-PAYGATE",
            UserId = 1,
            RestaurantId = 9,
            Status = OrderStatus.Pending,
            PaymentMethod = method,
            PaymentStatus = paymentStatus,
            GrandTotal = 100
        };
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();
        return order;
    }

    [Theory]
    [InlineData("PENDING_PAYMENT")]
    [InlineData("FAILED")]
    [InlineData("PENDING")]
    public async Task OnlineOrder_CannotBeAccepted_UntilPaid(string paymentStatus)
    {
        var db = NewDb();
        await PendingOrder(db, "ONLINE", paymentStatus);
        var result = await Vendor(db, 1).UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "ACCEPTED" });
        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse>(bad.Value);
        Assert.Contains("not verified", body.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(OrderStatus.Pending, (await db.FoodOrders.SingleAsync()).Status);
    }

    [Fact]
    public async Task PaidOnlineOrder_AndCod_CanBeAccepted()
    {
        var db = NewDb();
        await PendingOrder(db, "ONLINE", "PAID");
        var paid = await Vendor(db, 1).UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "ACCEPTED" });
        Assert.IsType<OkObjectResult>(paid.Result);

        var codDb = NewDb();
        await PendingOrder(codDb, "COD", "PENDING");
        var cod = await Vendor(codDb, 1).UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "ACCEPTED" });
        Assert.IsType<OkObjectResult>(cod.Result);
    }

    [Fact]
    public async Task Restaurant_CannotPickupOrDeliver()
    {
        var db = NewDb();
        await PendingOrder(db, "COD", "PENDING");
        var api = Vendor(db, 1);
        Assert.IsType<OkObjectResult>((await api.UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "ACCEPTED" })).Result);
        Assert.IsType<OkObjectResult>((await api.UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "PREPARING" })).Result);
        Assert.IsType<OkObjectResult>((await api.UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "READY" })).Result);
        Assert.IsType<BadRequestObjectResult>((await api.UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "PICKED_UP" })).Result);
        Assert.IsType<BadRequestObjectResult>((await api.UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "DELIVERED" })).Result);
        db.FoodOrders.Single().Status = OrderStatus.PickedUp;
        await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>((await api.UpdateOrderStatus(41, new UpdateOrderStatusRequest { Status = "DELIVERED" })).Result);
    }

    [Theory]
    [InlineData("COD", "PENDING", "COMPLETED")]
    [InlineData("CASH", "PENDING", "COMPLETED")]
    [InlineData("ONLINE", "PAID", "COMPLETED")]
    [InlineData("ONLINE", "PENDING", "PENDING")]
    [InlineData("ONLINE", "FAILED", "FAILED")]
    public void RideCompletion_DoesNotInventOnlinePayment(string method, string before, string after)
    {
        var ride = new Ride { PaymentMethod = method, PaymentStatus = before, EstimatedFare = 80, Status = RideStatus.Started };
        RideCompletion.MarkCompleted(ride);
        Assert.Equal(RideStatus.Completed, ride.Status);
        Assert.Equal(80, ride.ActualFare);
        Assert.Equal(after, ride.PaymentStatus);
    }

    [Theory]
    [InlineData("BIKE")]
    [InlineData("auto")]
    [InlineData("Cab")]
    public async Task BookRide_AcceptsConfiguredVehicleTypes(string vehicleType)
    {
        var db = NewDb();
        db.Users.Add(new User { Id = 5, MobileNumber = "9000002222", FullName = "Rider" });
        await db.SaveChangesAsync();
        var api = RideApi(db, 5);
        var result = await api.BookRide(SampleBook(vehicleType));
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<ApiResponse<RideDto>>(ok.Value).Data!;
        Assert.Equal(vehicleType.Trim().ToUpperInvariant(), dto.VehicleType);
    }

    [Fact]
    public async Task BookRide_RejectsUnknownVehicleType()
    {
        var db = NewDb();
        db.Users.Add(new User { Id = 5, MobileNumber = "9000002222", FullName = "Rider" });
        await db.SaveChangesAsync();
        var result = await RideApi(db, 5).BookRide(SampleBook("HELICOPTER"));
        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<RideDto>>(bad.Value);
        Assert.Contains("BIKE, AUTO, CAB", body.Message);
        Assert.Equal(0, await db.Rides.CountAsync());
    }

    [Fact]
    public async Task EmptyAdminReport_ReturnsZeros()
    {
        var db = NewDb();
        db.Restaurants.Add(new Restaurant { Id = 1, Name = "Empty", IsActive = true, Rating = 4 });
        db.Users.Add(new User { Id = 2, MobileNumber = "9000003333", FullName = "Driver User" });
        db.Drivers.Add(new Driver { Id = 3, UserId = 2, IsActive = true, TotalRides = 0, Rating = 5 });
        await db.SaveChangesAsync();
        var api = new AdminController(db);
        var ok = Assert.IsType<OkObjectResult>((await api.GetReports()).Result);
        var report = Assert.IsType<ApiResponse<AdminReportDto>>(ok.Value).Data!;
        Assert.Equal(0, report.TotalFoodSales);
        Assert.Equal(0, report.TotalRideFares);
        Assert.Equal(0, report.TotalCompletedOrders);
        Assert.Equal(0, report.TotalCompletedRides);
        Assert.Equal(0, report.TopRestaurants.Single().Revenue);
        Assert.Equal(0, report.TopRestaurants.Single().TotalCount);
        Assert.Equal(0, report.TopDrivers.Single().Revenue);
    }

    [Fact]
    public async Task FailedOrder_DoesNotConsumeCoupon_AndLimitsStillHold()
    {
        var db = NewDb();
        db.Coupons.Add(new Coupon
        {
            Id = 3,
            Code = "ONCE",
            DiscountType = "FLAT",
            DiscountValue = 10,
            StartDate = DateTime.UtcNow.AddDays(-1),
            ExpiryDate = DateTime.UtcNow.AddDays(2),
            ApplicableModule = "ALL",
            TotalUsageLimit = 1,
            PerUserLimit = 1,
            IsActive = true
        });
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CouponEngine.ConsumeForOrderAsync(db, "ONCE", "FOOD", 100, null, 8, _ => throw new InvalidOperationException("order failed")));

        var coupon = await db.Coupons.SingleAsync();
        Assert.Equal(0, coupon.CurrentUsageCount);
        Assert.Equal(0, await db.CouponUsages.CountAsync());

        var saved = await CouponEngine.ConsumeForOrderAsync(db, "ONCE", "FOOD", 100, null, 8, async quote =>
        {
            db.FoodOrders.Add(new FoodOrder
            {
                OrderNumber = "FO-COUPONOK",
                UserId = 8,
                RestaurantId = 1,
                Status = OrderStatus.Pending,
                GrandTotal = 90,
                CouponId = quote.Coupon!.Id,
                PaymentMethod = "COD",
                PaymentStatus = "PENDING"
            });
            await db.SaveChangesAsync();
        });
        Assert.True(saved.IsValid);
        Assert.Equal(1, (await db.Coupons.SingleAsync()).CurrentUsageCount);
        Assert.Equal(1, await db.FoodOrders.CountAsync());

        var retry = await CouponEngine.ConsumeForOrderAsync(db, "ONCE", "FOOD", 100, null, 8, _ => Task.CompletedTask);
        var other = await CouponEngine.ConsumeForOrderAsync(db, "ONCE", "FOOD", 100, null, 9, _ => Task.CompletedTask);
        Assert.False(retry.IsValid);
        Assert.False(other.IsValid);
        Assert.Equal(1, (await db.Coupons.SingleAsync()).CurrentUsageCount);
        Assert.Equal(1, await db.CouponUsages.CountAsync());
    }

    private static RidesController RideApi(AppDbContext db, long userId)
    {
        var clients = new Mock<IHubClients>();
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(new Mock<IClientProxy>().Object);
        var hub = new Mock<IHubContext<RideTrackingHub>>();
        hub.Setup(h => h.Clients).Returns(clients.Object);
        var api = new RidesController(db, hub.Object, new MockMapService());
        api.ControllerContext = new ControllerContext
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
        return api;
    }

    private static BookRideRequest SampleBook(string vehicleType) => new()
    {
        VehicleType = vehicleType,
        PickupAddress = "A",
        PickupLatitude = 28.61m,
        PickupLongitude = 77.20m,
        DropoffAddress = "B",
        DropoffLatitude = 28.70m,
        DropoffLongitude = 77.10m,
        PaymentMethod = "CASH"
    };
}
