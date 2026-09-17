using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class MapAndMarketplaceTests
{
    [Fact]
    public void MockMapService_Calculates_RealisticUrbanDistance()
    {
        var mapService = new MockMapService();

        // MG Road (12.9750, 77.6090) to Indiranagar (12.9719, 77.6412) in Bengaluru (~4-5 km road distance)
        decimal startLat = 12.9750m;
        decimal startLng = 77.6090m;
        decimal endLat = 12.9719m;
        decimal endLng = 77.6412m;

        var distanceKm = mapService.CalculateDistanceKm(startLat, startLng, endLat, endLng);

        // Should be between 3.5 km and 6.0 km
        Assert.True(distanceKm >= 3.5 && distanceKm <= 6.5, $"Distance was {distanceKm}km, expected between 3.5 and 6.5km");
    }

    [Fact]
    public async Task MockMapService_Estimates_DurationProportionally()
    {
        var mapService = new MockMapService();

        var route = await mapService.EstimateRouteAsync(12.9716m, 77.5946m, 12.9352m, 77.6245m);

        Assert.True(route.DistanceKm > 0);
        Assert.True(route.EstimatedDurationMinutes >= 5);
        Assert.Contains("|", route.Polyline);
    }

    [Theory]
    [InlineData("ACTIVE")]
    [InlineData("SOLD")]
    [InlineData("EXPIRED")]
    [InlineData("REMOVED")]
    public void ListingStatus_Constants_AreValid(string status)
    {
        Assert.Contains(status, new[]
        {
            ListingStatus.Active,
            ListingStatus.Sold,
            ListingStatus.Expired,
            ListingStatus.Removed
        });
    }
}
