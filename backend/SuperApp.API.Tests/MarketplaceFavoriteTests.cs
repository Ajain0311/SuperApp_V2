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

public class MarketplaceFavoriteTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("FavTests_" + Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options);
    }

    private static void SetUser(ControllerBase controller, long userId)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")),
            },
        };
    }

    [Fact]
    public async Task ToggleFavorite_UnknownListing_Returns404()
    {
        await using var db = CreateDb();
        var user = new User
        {
            MobileNumber = "9000000999",
            FullName = "Fav User",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUser(controller, user.Id);

        var result = await controller.ToggleFavorite(99999999);
        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<bool>>(notFound.Value);
        Assert.False(body.Success);
        Assert.Contains("not found", body.Message ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Empty(db.Favorites);
    }

    [Fact]
    public async Task ToggleFavorite_ExistingListing_AddsThenRemoves()
    {
        await using var db = CreateDb();
        var user = new User
        {
            MobileNumber = "9000000888",
            FullName = "Fav Seller",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        var category = new MarketplaceCategory { Name = "Phones", IsActive = true };
        db.Users.Add(user);
        db.MarketplaceCategories.Add(category);
        await db.SaveChangesAsync();

        var listing = new MarketplaceListing
        {
            UserId = user.Id,
            CategoryId = category.Id,
            Title = "Phone",
            Price = 1000m,
            Status = ListingStatus.Active,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.MarketplaceListings.Add(listing);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUser(controller, user.Id);

        var add = await controller.ToggleFavorite(listing.Id);
        var addOk = Assert.IsType<OkObjectResult>(add.Result);
        Assert.True(Assert.IsType<ApiResponse<bool>>(addOk.Value).Data);
        Assert.Single(db.Favorites);

        var remove = await controller.ToggleFavorite(listing.Id);
        var removeOk = Assert.IsType<OkObjectResult>(remove.Result);
        Assert.False(Assert.IsType<ApiResponse<bool>>(removeOk.Value).Data);
        Assert.Empty(db.Favorites);
    }

    [Fact]
    public async Task GetListings_NegativePage_ClampsToValidPage()
    {
        await using var db = CreateDb();
        var user = new User
        {
            MobileNumber = "9000000777",
            FullName = "Pager",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        var category = new MarketplaceCategory { Name = "Gadgets", IsActive = true };
        db.Users.Add(user);
        db.MarketplaceCategories.Add(category);
        await db.SaveChangesAsync();
        db.MarketplaceListings.Add(new MarketplaceListing
        {
            UserId = user.Id,
            CategoryId = category.Id,
            Title = "Gadget",
            Price = 100m,
            Status = ListingStatus.Active,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUser(controller, user.Id);

        var result = await controller.GetListings(null, null, null, null, null, null, page: -5, pageSize: -1);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var body = Assert.IsType<ApiResponse<PagedResult<ListingSummaryDto>>>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal(1, body.Data!.Page);
        Assert.Equal(1, body.Data.PageSize);
        Assert.Single(body.Data.Items);
    }
}
