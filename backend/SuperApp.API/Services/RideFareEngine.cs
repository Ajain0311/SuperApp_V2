using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class FareComputation
{
    public decimal DistanceKm { get; set; }
    public int DurationMinutes { get; set; }
    public decimal BaseFare { get; set; }
    public decimal DistanceFare { get; set; }
    public decimal TimeFare { get; set; }
    public decimal BookingFee { get; set; }
    public decimal PlatformFee { get; set; }
    public decimal OptionsTotal { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public List<AppliedFareOption> Options { get; set; } = new();
}

public class AppliedFareOption
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public static class RideFareEngine
{
    public static FareComputation Quote(
        RideFareRule rule,
        IReadOnlyList<RideFareOption> catalog,
        IReadOnlyCollection<string>? optionCodes,
        decimal distanceKm,
        int durationMinutes,
        DateTime utcNow)
    {
        if (distanceKm < 0) distanceKm = 0;
        if (durationMinutes < 1) durationMinutes = 1;

        var billableKm = Math.Max(0, distanceKm - rule.IncludedDistanceKm);
        var distanceFare = Math.Round(billableKm * rule.PerKmRate, 2);
        var timeFare = Math.Round(durationMinutes * rule.PerMinuteRate, 2);
        var core = rule.BaseFare + distanceFare + timeFare + rule.BookingFee + rule.PlatformFee;
        if (core < rule.MinimumFare)
            core = rule.MinimumFare;

        var multiplier = rule.PeakMultiplier <= 0 ? 1m : rule.PeakMultiplier;
        var india = TimeZoneInfo.ConvertTimeFromUtc(utcNow, IndiaZone());
        if (rule.NightSurchargePercent > 0 && (india.Hour >= 22 || india.Hour < 5))
            multiplier += rule.NightSurchargePercent / 100m;
        core = Math.Round(core * multiplier, 2);

        var selected = new List<AppliedFareOption>();
        foreach (var code in (optionCodes ?? Array.Empty<string>()).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim().ToUpperInvariant()).Distinct())
        {
            var option = catalog.FirstOrDefault(o => o.Code.Equals(code, StringComparison.OrdinalIgnoreCase));
            if (option == null)
                throw new InvalidFareException($"Unknown ride option '{code}'");
            if (!option.IsEnabled)
                throw new InvalidFareException($"Ride option '{option.Name}' is not available");
            if (!Applies(option, rule.VehicleType))
                throw new InvalidFareException($"Ride option '{option.Name}' does not apply to {rule.VehicleType}");
            selected.Add(new AppliedFareOption { Code = option.Code, Name = option.Name, Amount = option.AdditionalAmount });
        }

        var optionsTotal = selected.Sum(o => o.Amount);
        var subtotal = core + optionsTotal;
        var tax = Math.Round(subtotal * (rule.TaxPercentage / 100m), 2);
        return new FareComputation
        {
            DistanceKm = Math.Round(distanceKm, 2),
            DurationMinutes = durationMinutes,
            BaseFare = rule.BaseFare,
            DistanceFare = distanceFare,
            TimeFare = timeFare,
            BookingFee = rule.BookingFee,
            PlatformFee = rule.PlatformFee,
            OptionsTotal = optionsTotal,
            Subtotal = subtotal,
            Tax = tax,
            Total = Math.Round(subtotal + tax, 0),
            Options = selected
        };
    }

    public static List<RideFareRule> DefaultRules() =>
    [
        Rule(VehicleTypes.Bike, 35, 25, 1.5m, 8, 1.0m, 5, 4, 10),
        Rule(VehicleTypes.Auto, 50, 35, 1.5m, 12, 1.5m, 8, 5, 10),
        Rule(VehicleTypes.Cab, 90, 55, 2m, 16, 2m, 15, 8, 10)
    ];

    public static List<RideFareOption> DefaultOptions() =>
    [
        new() { Code = "PRIORITY", Name = "Priority pickup", Description = "Shown first to nearby captains", AdditionalAmount = 10, IsEnabled = true, VehicleTypes = "ALL" },
        new() { Code = "CONVENIENCE", Name = "Extra convenience", Description = "Preferred pickup handling", AdditionalAmount = 20, IsEnabled = true, VehicleTypes = "ALL" },
        new() { Code = "WAITING", Name = "Extra waiting", Description = "A few extra minutes at pickup", AdditionalAmount = 30, IsEnabled = true, VehicleTypes = "ALL" }
    ];

    private static bool Applies(RideFareOption option, string vehicleType)
    {
        if (string.IsNullOrWhiteSpace(option.VehicleTypes) || option.VehicleTypes.Equals("ALL", StringComparison.OrdinalIgnoreCase))
            return true;
        return option.VehicleTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(v => v.Equals(vehicleType, StringComparison.OrdinalIgnoreCase));
    }

    private static RideFareRule Rule(string type, decimal min, decimal basis, decimal included, decimal perKm, decimal perMin, decimal booking, decimal platform, decimal night) =>
        new()
        {
            VehicleType = type,
            City = "DEFAULT",
            MinimumFare = min,
            BaseFare = basis,
            IncludedDistanceKm = included,
            PerKmRate = perKm,
            PerMinuteRate = perMin,
            BookingFee = booking,
            PlatformFee = platform,
            NightSurchargePercent = night,
            PeakMultiplier = 1,
            TaxPercentage = 0,
            IsActive = true
        };

    private static TimeZoneInfo IndiaZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); }
    }
}

public class InvalidFareException : Exception
{
    public InvalidFareException(string message) : base(message) { }
}
