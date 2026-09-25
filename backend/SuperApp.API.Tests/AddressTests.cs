using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class AddressTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("AddressTests_" + Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task SettingDefaultFlag_DoesNotClearLatitudeLongitude()
    {
        await using var db = CreateDb();

        var user = new User
        {
            MobileNumber = "9111111111",
            FullName = "Coord Keep",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var home = new Address
        {
            UserId = user.Id,
            Label = "Home",
            AddressLine1 = "Street A",
            City = "Jaipur",
            State = "Rajasthan",
            PinCode = "302001",
            Latitude = 26.9124m,
            Longitude = 75.7873m,
            IsDefault = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        var work = new Address
        {
            UserId = user.Id,
            Label = "Work",
            AddressLine1 = "Street B",
            City = "Jaipur",
            State = "Rajasthan",
            PinCode = "302002",
            Latitude = 26.95m,
            Longitude = 75.80m,
            IsDefault = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Addresses.AddRange(home, work);
        await db.SaveChangesAsync();

        // Same field-level mutation SetDefault performs (is_default only).
        home.IsDefault = false;
        work.IsDefault = true;
        work.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var refreshedHome = await db.Addresses.AsNoTracking().FirstAsync(a => a.Id == home.Id);
        var refreshedWork = await db.Addresses.AsNoTracking().FirstAsync(a => a.Id == work.Id);

        Assert.False(refreshedHome.IsDefault);
        Assert.Equal(26.9124m, refreshedHome.Latitude);
        Assert.Equal(75.7873m, refreshedHome.Longitude);

        Assert.True(refreshedWork.IsDefault);
        Assert.Equal(26.95m, refreshedWork.Latitude);
        Assert.Equal(75.80m, refreshedWork.Longitude);
    }

    [Fact]
    public async Task UpdateWithoutCoordinates_PreservesExistingPins()
    {
        await using var db = CreateDb();

        var user = new User
        {
            MobileNumber = "9222222222",
            FullName = "Update Keep",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var address = new Address
        {
            UserId = user.Id,
            Label = "Home",
            AddressLine1 = "Old Street",
            City = "Udaipur",
            State = "Rajasthan",
            PinCode = "313001",
            Latitude = 24.572846m,
            Longitude = 73.723135m,
            IsDefault = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Addresses.Add(address);
        await db.SaveChangesAsync();

        // Mimic AddressesController.Update when client omits latitude/longitude.
        address.AddressLine1 = "New Street";
        address.IsDefault = true;
        address.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var refreshed = await db.Addresses.AsNoTracking().FirstAsync(a => a.Id == address.Id);
        Assert.Equal("New Street", refreshed.AddressLine1);
        Assert.Equal(24.572846m, refreshed.Latitude);
        Assert.Equal(73.723135m, refreshed.Longitude);
        Assert.True(refreshed.IsDefault);
    }
}
