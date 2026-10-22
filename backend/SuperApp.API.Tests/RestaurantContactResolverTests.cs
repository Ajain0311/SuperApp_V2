using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class RestaurantContactResolverTests
{
    [Fact]
    public void ResolveOwnerPhone_WhenRestaurantPhoneMatchesOwner_UsesMatchedOwner()
    {
        var owners = new List<(string MobileNumber, string? FullName)>
        {
            ("9900000003", "Owner A (Meghana)"),
            ("9205917901", "RESTAURANT_OWNER B run-mumfwror"),
        };

        var resolved = RestaurantContactResolver.ResolveOwnerPhone("+919900000003", owners);

        Assert.Equal("9900000003", resolved);
    }

    [Fact]
    public void ResolveOwnerPhone_WhenRestaurantPhoneIsCustomerOnly_UsesStableOwner()
    {
        // Production bug: Roll Junction restaurants.phone = +919810088990 belongs to
        // CUSTOMER "Suraj", while linked owners are different numbers.
        var owners = new List<(string MobileNumber, string? FullName)>
        {
            ("9203979806", "RESTAURANT_OWNER G run-mumxrcvq"),
            ("9900000099", "Roll Junction Manager"),
            ("9257802906", "RESTAURANT_OWNER G run-mv7nhlkd"),
        };

        var resolved = RestaurantContactResolver.ResolveOwnerPhone("+919810088990", owners);

        Assert.Equal("9900000099", resolved);
    }

    [Fact]
    public void ResolveOwnerPhone_WhenOnlyLoadTestOwners_UsesOldestOwner()
    {
        var owners = new List<(string MobileNumber, string? FullName)>
        {
            ("9203979806", "RESTAURANT_OWNER G run-mumxrcvq"),
            ("9257802906", "RESTAURANT_OWNER G run-mv7nhlkd"),
        };

        var resolved = RestaurantContactResolver.ResolveOwnerPhone("+919810088990", owners);

        Assert.Equal("9203979806", resolved);
    }

    [Fact]
    public void ResolveOwnerPhone_WhenNoOwners_FallsBackToRestaurantPhone()
    {
        var resolved = RestaurantContactResolver.ResolveOwnerPhone("+919810088990", Array.Empty<(string, string?)>());

        Assert.Equal("+919810088990", resolved);
    }

    [Fact]
    public void NormalizeLast10_StripsCountryCode()
    {
        Assert.Equal("9810088990", RestaurantContactResolver.NormalizeLast10("+919810088990"));
        Assert.Equal("7014065979", RestaurantContactResolver.NormalizeLast10("7014065979"));
    }
}
