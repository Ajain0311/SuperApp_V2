using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.DTOs;

public class DriverProfileDto
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string MobileNumber { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
    public bool IsVerified { get; set; }
    public bool IsOnline { get; set; }
    public decimal? CurrentLatitude { get; set; }
    public decimal? CurrentLongitude { get; set; }
    public decimal Rating { get; set; }
    public int TotalRides { get; set; }
    public VehicleDto? Vehicle { get; set; }
}

public class VehicleDto
{
    public long Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Make { get; set; }
    public string? Model { get; set; }
    public string RegistrationNumber { get; set; } = string.Empty;
    public string? Color { get; set; }
    public int? Year { get; set; }
}

public class ToggleOnlineRequest
{
    public bool IsOnline { get; set; }
}

public class UpdateDriverLocationRequest
{
    public long? RideId { get; set; }
    [Required]
    public decimal Latitude { get; set; }
    [Required]
    public decimal Longitude { get; set; }
    public double? Heading { get; set; }
    public double? Speed { get; set; }
}

public class DriverEarningsDto
{
    public decimal TodayEarnings { get; set; }
    public int TodayRides { get; set; }
    public decimal WeeklyEarnings { get; set; }
    public int WeeklyRides { get; set; }
    public decimal TotalEarnings { get; set; }
    public int TotalRides { get; set; }
    public List<DriverRideSummaryDto> RecentTrips { get; set; } = new();
}

public class DriverRideSummaryDto
{
    public long Id { get; set; }
    public string RideNumber { get; set; } = string.Empty;
    public string PickupAddress { get; set; } = string.Empty;
    public string DropoffAddress { get; set; } = string.Empty;
    public decimal Fare { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? OtpCode { get; set; }
}
