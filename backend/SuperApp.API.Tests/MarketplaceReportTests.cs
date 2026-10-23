using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class MarketplaceReportTests
{
    private static AppDbContext GetDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static void SetUser(ControllerBase controller, long? userId)
    {
        var claims = new List<Claim>();
        if (userId.HasValue)
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, userId.HasValue ? "TestAuth" : null))
            }
        };
    }

    private static async Task<(AppDbContext db, MarketplaceListing listing)> SeedActiveListingAsync()
    {
        var db = GetDb();
        var seller = new User { Id = 10, FullName = "Seller", MobileNumber = "9000000010" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "Live Bike",
            Price = 25000m,
            IsActive = true,
            Status = ListingStatus.Active,
            CategoryId = 1
        };
        db.Users.Add(seller);
        db.MarketplaceListings.Add(listing);
        await db.SaveChangesAsync();
        return (db, listing);
    }

    [Fact]
    public async Task ReportListing_Anonymous_CannotDeactivateListing()
    {
        var (db, listing) = await SeedActiveListingAsync();
        var controller = new MarketplaceController(db);
        SetUser(controller, userId: null);

        var res = await controller.ReportListing(listing.Id, new ReportListingRequest
        {
            Reason = "SPAM",
            Details = "Anonymous attack"
        });

        Assert.IsType<UnauthorizedObjectResult>(res.Result);

        await db.Entry(listing).ReloadAsync();
        Assert.True(listing.IsActive);
        Assert.Equal(ListingStatus.Active, listing.Status);
    }

    [Fact]
    public async Task ReportListing_Authenticated_FlagsForReview_DoesNotRemove()
    {
        var (db, listing) = await SeedActiveListingAsync();
        var reporter = new User { Id = 20, FullName = "Reporter", MobileNumber = "9000000020" };
        db.Users.Add(reporter);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUser(controller, reporter.Id);

        var res = await controller.ReportListing(listing.Id, new ReportListingRequest
        {
            Reason = "FRAUD",
            Details = "Looks fake"
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var api = Assert.IsType<ApiResponse>(ok.Value);
        Assert.True(api.Success);

        await db.Entry(listing).ReloadAsync();
        Assert.True(listing.IsActive, "Listing must stay live until admin reviews");
        Assert.Equal(ListingStatus.Flagged, listing.Status);
    }

    [Fact]
    public async Task ReportListing_OwnerCannotReportOwnListing()
    {
        var (db, listing) = await SeedActiveListingAsync();
        var controller = new MarketplaceController(db);
        SetUser(controller, listing.UserId);

        var res = await controller.ReportListing(listing.Id, new ReportListingRequest { Reason = "SPAM" });
        Assert.IsType<BadRequestObjectResult>(res.Result);

        await db.Entry(listing).ReloadAsync();
        Assert.True(listing.IsActive);
        Assert.Equal(ListingStatus.Active, listing.Status);
    }
}
