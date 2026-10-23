using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class AdminListingsModerationTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static void SetAdmin(ControllerBase controller, long adminId = 1)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, adminId.ToString()),
            new Claim(ClaimTypes.Role, RoleNames.Admin)
        }, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
    }

    [Fact]
    public async Task GetFoodItems_ReturnsOwnerPriceDiscountAndAllowsStatusEditDelete()
    {
        await using var db = CreateDb();
        var owner = new User { Id = 10, FullName = "Hotel Owner", MobileNumber = "9000000010" };
        var restaurant = new Restaurant { Id = 1, Name = "Spice Hub", IsActive = true };
        var category = new RestaurantCategory { Id = 1, RestaurantId = 1, Name = "Mains" };
        db.Users.Add(owner);
        db.Restaurants.Add(restaurant);
        db.RestaurantCategories.Add(category);
        db.RestaurantUsers.Add(new RestaurantUser
        {
            UserId = owner.Id,
            RestaurantId = restaurant.Id,
            IsActive = true
        });
        var item = new FoodItem
        {
            Id = 50,
            RestaurantId = restaurant.Id,
            RestaurantCategoryId = category.Id,
            Name = "Butter Chicken",
            Description = "Creamy",
            BasePrice = 340m,
            DiscountPercent = 15m,
            IsAvailable = true,
            IsActive = true,
            IsVeg = false
        };
        db.FoodItems.Add(item);
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        SetAdmin(controller);

        var listRes = await controller.GetFoodItems(null, "Butter");
        var listOk = Assert.IsType<OkObjectResult>(listRes.Result);
        var listApi = Assert.IsType<ApiResponse<List<AdminFoodItemDto>>>(listOk.Value);
        Assert.True(listApi.Success);
        var dto = Assert.Single(listApi.Data!);
        Assert.Equal("Butter Chicken", dto.Name);
        Assert.Equal(340m, dto.BasePrice);
        Assert.Equal(15m, dto.DiscountPercent);
        Assert.Equal(289m, dto.DiscountedPrice);
        Assert.Equal("Spice Hub", dto.RestaurantName);
        Assert.Equal("Hotel Owner", dto.OwnerName);
        Assert.Equal("9000000010", dto.OwnerPhone);

        var statusRes = await controller.ManageFoodItem(new AdminFoodItemActionRequest
        {
            Action = "STATUS",
            FoodItemId = item.Id,
            IsAvailable = false
        });
        Assert.IsType<OkObjectResult>(statusRes.Result);
        await db.Entry(item).ReloadAsync();
        Assert.False(item.IsAvailable);

        var editRes = await controller.ManageFoodItem(new AdminFoodItemActionRequest
        {
            Action = "EDIT",
            FoodItemId = item.Id,
            Name = "Butter Chicken Special",
            BasePrice = 360m,
            DiscountPercent = 10m
        });
        Assert.IsType<OkObjectResult>(editRes.Result);
        await db.Entry(item).ReloadAsync();
        Assert.Equal("Butter Chicken Special", item.Name);
        Assert.Equal(360m, item.BasePrice);
        Assert.Equal(10m, item.DiscountPercent);

        var badDiscount = await controller.ManageFoodItem(new AdminFoodItemActionRequest
        {
            Action = "EDIT",
            FoodItemId = item.Id,
            DiscountPercent = 150m
        });
        Assert.IsType<BadRequestObjectResult>(badDiscount.Result);

        var deleteRes = await controller.ManageFoodItem(new AdminFoodItemActionRequest
        {
            Action = "DELETE",
            FoodItemId = item.Id
        });
        Assert.IsType<OkObjectResult>(deleteRes.Result);
        await db.Entry(item).ReloadAsync();
        Assert.False(item.IsActive);
        Assert.False(item.IsAvailable);
    }

    [Fact]
    public async Task GetMarketplaceListings_IncludesSeller_AndEditDoesNotRequireFeatureFlag()
    {
        await using var db = CreateDb();
        var seller = new User { Id = 20, FullName = "Bazaar Seller", MobileNumber = "9000000020" };
        var category = new MarketplaceCategory { Id = 1, Name = "Electronics" };
        db.Users.Add(seller);
        db.MarketplaceCategories.Add(category);
        var listing = new MarketplaceListing
        {
            Id = 70,
            UserId = seller.Id,
            CategoryId = category.Id,
            Title = "Used Phone",
            Description = "Good condition",
            Price = 12000m,
            Status = ListingStatus.Active,
            IsActive = true
        };
        db.MarketplaceListings.Add(listing);
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        SetAdmin(controller);

        var listRes = await controller.GetMarketplaceListings(null, "Phone");
        var listOk = Assert.IsType<OkObjectResult>(listRes.Result);
        var listApi = Assert.IsType<ApiResponse<List<AdminMarketplaceListingDto>>>(listOk.Value);
        Assert.True(listApi.Success);
        var dto = Assert.Single(listApi.Data!);
        Assert.Equal("Used Phone", dto.Title);
        Assert.Equal(seller.Id, dto.SellerId);
        Assert.Equal("Bazaar Seller", dto.SellerName);
        Assert.Equal("9000000020", dto.SellerPhone);
        Assert.Equal("Electronics", dto.CategoryName);

        var editRes = await controller.ManageMarketplaceListing(new AdminListingActionRequest
        {
            Action = "EDIT",
            ListingId = listing.Id,
            Title = "Used Phone XL",
            Price = 11000m
        });
        Assert.IsType<OkObjectResult>(editRes.Result);
        await db.Entry(listing).ReloadAsync();
        Assert.Equal("Used Phone XL", listing.Title);
        Assert.Equal(11000m, listing.Price);
    }
}
