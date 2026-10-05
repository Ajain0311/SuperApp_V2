using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class RideFareEngineTests
{
    private static readonly DateTime AfternoonUtc = new(2026, 6, 1, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ShortRide_UsesMinimum_AndIgnoresCheapLegacyRate()
    {
        var rule = RideFareEngine.DefaultRules().Single(r => r.VehicleType == "BIKE");
        var quote = RideFareEngine.Quote(rule, RideFareEngine.DefaultOptions(), null, 0.4m, 4, AfternoonUtc);
        Assert.True(quote.Total >= rule.MinimumFare);
        var legacy = 20m + (0.4m * 1.5m);
        Assert.True(quote.Total > legacy);
    }

    [Fact]
    public void MediumRide_AddsDistanceTimeAndFees()
    {
        var rule = RideFareEngine.DefaultRules().Single(r => r.VehicleType == "BIKE");
        var quote = RideFareEngine.Quote(rule, RideFareEngine.DefaultOptions(), null, 8.4m, 24, AfternoonUtc);
        var expectedDistance = Math.Round((8.4m - rule.IncludedDistanceKm) * rule.PerKmRate, 2);
        Assert.Equal(expectedDistance, quote.DistanceFare);
        Assert.Equal(Math.Round(24 * rule.PerMinuteRate, 2), quote.TimeFare);
        Assert.Equal(rule.BookingFee + rule.PlatformFee, quote.BookingFee + quote.PlatformFee);
        Assert.True(quote.Total > 80);
    }

    [Fact]
    public void Options_AddExactAmounts_AndRejectUnknownOrDisabled()
    {
        var rule = RideFareEngine.DefaultRules().Single(r => r.VehicleType == "AUTO");
        var catalog = RideFareEngine.DefaultOptions();
        var plain = RideFareEngine.Quote(rule, catalog, null, 6m, 18, AfternoonUtc);
        var with = RideFareEngine.Quote(rule, catalog, new[] { "PRIORITY", "CONVENIENCE" }, 6m, 18, AfternoonUtc);
        Assert.Equal(30, with.OptionsTotal);
        Assert.Equal(plain.Total + 30, with.Total);

        Assert.Throws<InvalidFareException>(() =>
            RideFareEngine.Quote(rule, catalog, new[] { "FREE_RIDE" }, 6m, 18, AfternoonUtc));

        catalog.Single(o => o.Code == "WAITING").IsEnabled = false;
        Assert.Throws<InvalidFareException>(() =>
            RideFareEngine.Quote(rule, catalog, new[] { "WAITING" }, 6m, 18, AfternoonUtc));
    }

    [Fact]
    public void Categories_Differ_AndCabIsHighestOnSameTrip()
    {
        var rules = RideFareEngine.DefaultRules();
        var options = RideFareEngine.DefaultOptions();
        var bike = RideFareEngine.Quote(rules.Single(r => r.VehicleType == "BIKE"), options, null, 12m, 30, AfternoonUtc);
        var auto = RideFareEngine.Quote(rules.Single(r => r.VehicleType == "AUTO"), options, null, 12m, 30, AfternoonUtc);
        var cab = RideFareEngine.Quote(rules.Single(r => r.VehicleType == "CAB"), options, null, 12m, 30, AfternoonUtc);
        Assert.True(cab.Total > auto.Total);
        Assert.True(auto.Total > bike.Total);
    }
}
