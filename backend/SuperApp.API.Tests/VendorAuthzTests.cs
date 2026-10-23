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
using Xunit;

namespace SuperApp.API.Tests;

public class VendorAuthzTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("VendorAuthz_" + Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options);
    }

    private static VendorController CreateController(AppDbContext db, long userId)
    {
        var hub = new Mock<IHubContext<OrderStatusHub>>();
        var controller = new VendorController(db, hub.Object);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, RoleNames.Customer),
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")),
            },
        };
        return controller;
    }

    [Fact]
    public async Task Customer_VendorDashboard_Returns403()
    {
        await using var db = CreateDb();
        var user = new User { MobileNumber = "9000001401", FullName = "Cust", IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, user.Id);
        var result = await controller.GetVendorDashboard();
        var forbid = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbid.StatusCode);
    }

    [Fact]
    public async Task Customer_VendorCategories_Returns403()
    {
        await using var db = CreateDb();
        var user = new User { MobileNumber = "9000001402", FullName = "Cust", IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = CreateController(db, user.Id);
        var result = await controller.ManageCategory(new VendorCategoryActionRequest { Action = "ADD", Name = "hack" });
        var forbid = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbid.StatusCode);
    }

    [Fact]
    public async Task PlaceOrder_ClosedRestaurant_Returns400()
    {
        await using var db = CreateDb();
        var user = new User { MobileNumber = "9000001403", FullName = "Buyer", IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Users.Add(user);
        var restaurant = new Restaurant
        {
            Name = "Closed Hotel",
            IsActive = false,
            City = "Jaipur",
            DeliveryFee = 20,
            AvgDeliveryTimeMinutes = 30,
            CreatedAt = DateTime.UtcNow,
        };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        var addr = new Address
        {
            UserId = user.Id,
            Label = "Home",
            AddressLine1 = "Street",
            City = "Jaipur",
            State = "Rajasthan",
            PinCode = "302001",
            IsActive = true,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Addresses.Add(addr);
        await db.SaveChangesAsync();

        var orderHub = new Mock<IHubContext<OrderStatusHub>>();
        var controller = new FoodOrdersController(db, orderHub.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                }, "Test")),
            },
        };

        var result = await controller.PlaceOrder(new PlaceFoodOrderRequest
        {
            RestaurantId = restaurant.Id,
            AddressId = addr.Id,
            PaymentMethod = "COD",
            Items = new List<OrderItemRequest> { new() { FoodItemId = 1, Quantity = 1 } },
        });
        var bad = Assert.IsType<BadRequestObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<FoodOrderDto>>(bad.Value);
        Assert.Contains("closed", body.Message ?? "", StringComparison.OrdinalIgnoreCase);
    }
}
