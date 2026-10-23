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

public class FoodCatalogAndCheckoutTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static async Task SeedTwoRestaurantsAsync(AppDbContext db)
    {
        var r1 = new Restaurant { Id = 1, Name = "Hotel One", IsActive = true, DeliveryFee = 10, AvgDeliveryTimeMinutes = 20, Rating = 4.5m };
        var r2 = new Restaurant { Id = 2, Name = "Hotel Two", IsActive = true, DeliveryFee = 15, AvgDeliveryTimeMinutes = 25, Rating = 4.2m };
        db.Restaurants.AddRange(r1, r2);
        var c1 = new RestaurantCategory { Id = 1, RestaurantId = 1, Name = "Mains", IsActive = true };
        var c2 = new RestaurantCategory { Id = 2, RestaurantId = 2, Name = "Burgers", IsActive = true };
        db.RestaurantCategories.AddRange(c1, c2);
        db.FoodItems.AddRange(
            new FoodItem
            {
                Id = 11,
                RestaurantId = 1,
                RestaurantCategoryId = 1,
                Name = "Veg Thali",
                BasePrice = 200,
                IsActive = true,
                IsAvailable = true,
                IsVeg = true,
                IsBestseller = true
            },
            new FoodItem
            {
                Id = 22,
                RestaurantId = 2,
                RestaurantCategoryId = 2,
                Name = "Cheese Burger",
                BasePrice = 150,
                IsActive = true,
                IsAvailable = true,
                IsVeg = false,
                IsBestseller = false
            });
        db.Users.Add(new User { Id = 50, MobileNumber = "9000000050", FullName = "Customer 50" });
        db.Addresses.Add(new Address
        {
            Id = 50,
            UserId = 50,
            AddressLine1 = "Street 1",
            City = "Jaipur",
            IsActive = true,
            IsDefault = true
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetFoods_ReturnsDishesAcrossRestaurants()
    {
        var db = CreateDb();
        await SeedTwoRestaurantsAsync(db);
        var controller = new RestaurantsController(db);

        var result = await controller.GetFoods(search: null, category: null, isVegOnly: null, isBestseller: null, restaurantId: null, city: null);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<PagedResult<FoodCatalogItemDto>>>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal(2, body.Data!.TotalCount);
        Assert.Contains(body.Data.Items, i => i.Name == "Veg Thali" && i.RestaurantId == 1);
        Assert.Contains(body.Data.Items, i => i.Name == "Cheese Burger" && i.RestaurantId == 2);
    }

    [Fact]
    public async Task Checkout_MultiRestaurant_Cod_CreatesSeparateKitchenOrders()
    {
        var db = CreateDb();
        await SeedTwoRestaurantsAsync(db);
        var hub = new Mock<IHubContext<OrderStatusHub>>();
        var clients = new Mock<IHubClients>();
        var proxy = new Mock<IClientProxy>();
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(proxy.Object);
        hub.Setup(h => h.Clients).Returns(clients.Object);

        var controller = new FoodOrdersController(db, hub.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, "50"),
                    new Claim(ClaimTypes.Role, RoleNames.Customer)
                }, "TestAuth"))
            }
        };

        var result = await controller.Checkout(new FoodCheckoutRequest
        {
            AddressId = 50,
            PaymentMethod = "COD",
            Notes = "multi-test",
            Items = new List<OrderItemRequest>
            {
                new() { FoodItemId = 11, Quantity = 1 },
                new() { FoodItemId = 22, Quantity = 1 }
            }
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<FoodCheckoutResultDto>>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal(2, body.Data!.RestaurantCount);
        Assert.Equal(2, body.Data.Orders.Count);
        Assert.Contains(body.Data.Orders, o => o.RestaurantId == 1 && o.Items.All(i => i.FoodItemId == 11));
        Assert.Contains(body.Data.Orders, o => o.RestaurantId == 2 && o.Items.All(i => i.FoodItemId == 22));

        var stored = await db.FoodOrders.Include(o => o.Items).ToListAsync();
        Assert.Equal(2, stored.Count);
        Assert.All(stored, o => Assert.Equal(OrderStatus.Accepted, o.Status));
    }

    [Fact]
    public async Task Checkout_MultiRestaurant_Online_IsSupported()
    {
        var db = CreateDb();
        await SeedTwoRestaurantsAsync(db);
        var hub = new Mock<IHubContext<OrderStatusHub>>();
        var controller = new FoodOrdersController(db, hub.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, "50"),
                    new Claim(ClaimTypes.Role, RoleNames.Customer)
                }, "TestAuth"))
            }
        };

        var result = await controller.Checkout(new FoodCheckoutRequest
        {
            AddressId = 50,
            PaymentMethod = "ONLINE",
            Items = new List<OrderItemRequest>
            {
                new() { FoodItemId = 11, Quantity = 1 },
                new() { FoodItemId = 22, Quantity = 1 }
            }
        });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<FoodCheckoutResultDto>>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal(2, body.Data!.RestaurantCount);
        Assert.False(string.IsNullOrEmpty(body.Data.CheckoutGroupId));

        var stored = await db.FoodOrders.ToListAsync();
        Assert.Equal(2, stored.Count);
        Assert.All(stored, o => Assert.Equal("PENDING_PAYMENT", o.PaymentStatus));
    }
}
