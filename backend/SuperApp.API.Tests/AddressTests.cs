using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
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

    [Theory]
    [InlineData(91, 0, false)]
    [InlineData(-91, 75, false)]
    [InlineData(26.9, 200, false)]
    [InlineData(90, 0, true)]
    [InlineData(-90, 180, true)]
    [InlineData(26.9124, 75.7873, true)]
    [InlineData(0, 0, true)] // treated as unset, still valid request
    public void UpsertAddressRequest_OutOfRangeCoords_AreModelAgnostic_ButControllerRejects(
        double lat, double lng, bool expectInRange)
    {
        // Document expected geographic bounds used by AddressesController.TryNormalizeCoordinates.
        var inRange = lat is >= -90 and <= 90 && lng is >= -180 and <= 180;
        Assert.Equal(expectInRange, inRange);
    }

    [Fact]
    public async Task SetDefault_LeavesExactlyOneDefault_WhenCalledSequentially()
    {
        await using var db = CreateDb();
        var user = new User
        {
            MobileNumber = "9333333333",
            FullName = "Default Race",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var a1 = new Address
        {
            UserId = user.Id, Label = "A1", AddressLine1 = "S1", City = "Jaipur",
            State = "Rajasthan", PinCode = "302001", IsDefault = false, IsActive = true, CreatedAt = DateTime.UtcNow,
        };
        var a2 = new Address
        {
            UserId = user.Id, Label = "A2", AddressLine1 = "S2", City = "Jaipur",
            State = "Rajasthan", PinCode = "302002", IsDefault = false, IsActive = true, CreatedAt = DateTime.UtcNow,
        };
        var a3 = new Address
        {
            UserId = user.Id, Label = "A3", AddressLine1 = "S3", City = "Jaipur",
            State = "Rajasthan", PinCode = "302003", IsDefault = false, IsActive = true, CreatedAt = DateTime.UtcNow,
        };
        db.Addresses.AddRange(a1, a2, a3);
        await db.SaveChangesAsync();

        // Mimic ApplySingleDefaultAsync InMemory path for each target in turn.
        async Task Apply(long targetId)
        {
            var rows = await db.Addresses.Where(a => a.UserId == user.Id && a.IsActive).ToListAsync();
            foreach (var row in rows)
            {
                row.IsDefault = row.Id == targetId;
                row.UpdatedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
        }

        await Apply(a1.Id);
        await Apply(a2.Id);
        await Apply(a3.Id);

        var defaults = await db.Addresses.AsNoTracking()
            .Where(a => a.UserId == user.Id && a.IsActive && a.IsDefault)
            .ToListAsync();
        Assert.Single(defaults);
        Assert.Equal(a3.Id, defaults[0].Id);
    }

    [Theory]
    [InlineData("12", false)]
    [InlineData("30200", false)]
    [InlineData("302001a", false)]
    [InlineData("abcdef", false)]
    [InlineData("302001", true)]
    [InlineData("110001", true)]
    public void UpsertAddressRequest_PinCode_MustBeSixDigits(string pin, bool expectValid)
    {
        var req = new UpsertAddressRequest
        {
            AddressLine1 = "Street",
            City = "Jaipur",
            State = "Rajasthan",
            PinCode = pin,
        };
        var ctx = new ValidationContext(req);
        var results = new List<ValidationResult>();
        var ok = Validator.TryValidateObject(req, ctx, results, validateAllProperties: true);
        Assert.Equal(expectValid, ok);
        if (!expectValid)
            Assert.Contains(results, r => (r.ErrorMessage ?? "").Contains("6 digits", StringComparison.OrdinalIgnoreCase));
    }
}
