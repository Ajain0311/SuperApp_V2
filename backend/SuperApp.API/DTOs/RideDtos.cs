using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace SuperApp.API.DTOs;

public class RideEstimateRequest
{
    [Required]
    [JsonPropertyName("pickupAddress")]
    public string PickupAddress { get; set; } = string.Empty;

    [JsonPropertyName("pickupLatitude")]
    public decimal PickupLatitude { get; set; } = 28.6315m;

    [JsonPropertyName("pickupLat")]
    public decimal PickupLat { set => PickupLatitude = value; }

    [JsonPropertyName("pickupLongitude")]
    public decimal PickupLongitude { get; set; } = 77.2167m;

    [JsonPropertyName("pickupLng")]
    public decimal PickupLng { set => PickupLongitude = value; }

    [Required]
    [JsonPropertyName("dropoffAddress")]
    public string DropoffAddress { get; set; } = string.Empty;

    [JsonPropertyName("destinationAddress")]
    public string DestinationAddress { set => DropoffAddress = value; }

    [JsonPropertyName("dropoffLatitude")]
    public decimal DropoffLatitude { get; set; } = 28.5562m;

    [JsonPropertyName("destinationLat")]
    public decimal DestinationLat { set => DropoffLatitude = value; }

    [JsonPropertyName("dropoffLongitude")]
    public decimal DropoffLongitude { get; set; } = 77.1000m;

    [JsonPropertyName("destinationLng")]
    public decimal DestinationLng { set => DropoffLongitude = value; }
}

public class RideEstimateResponse
{
    public decimal DistanceKm { get; set; }
    public int EstimatedMinutes { get; set; }
    public string TrafficCondition { get; set; } = "Moderate Traffic";
    public List<VehicleEstimateDto> VehicleOptions { get; set; } = new();
}

public class VehicleEstimateDto
{
    public string VehicleType { get; set; } = string.Empty; // BIKE, AUTO, CAB
    public string Title { get; set; } = string.Empty;
    public string Tag { get; set; } = string.Empty; // FASTEST, VALUE, COMFORT
    public string Subtitle { get; set; } = string.Empty;
    public decimal EstimatedFare { get; set; }
    public int EtaMinutes { get; set; }
    public string IconName { get; set; } = string.Empty;
}

public class BookRideRequest
{
    [Required]
    public string VehicleType { get; set; } = "BIKE"; // BIKE, AUTO, CAB
    [Required]
    public string PickupAddress { get; set; } = string.Empty;
    public decimal PickupLatitude { get; set; } = 28.6315m;
    public decimal PickupLongitude { get; set; } = 77.2167m;

    [Required]
    public string DropoffAddress { get; set; } = string.Empty;
    public decimal DropoffLatitude { get; set; } = 28.5562m;
    public decimal DropoffLongitude { get; set; } = 77.1000m;

    public string PaymentMethod { get; set; } = "CASH";
}

public class RideDto
{
    public long Id { get; set; }
    public string RideNumber { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
    public string PickupAddress { get; set; } = string.Empty;
    public string DropoffAddress { get; set; } = string.Empty;
    public decimal? DistanceKm { get; set; }
    public decimal EstimatedFare { get; set; }
    public decimal? ActualFare { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? OtpCode { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentStatus { get; set; }
    public DateTime CreatedAt { get; set; }

    // Driver Details
    public DriverSummaryDto? Driver { get; set; }
}

public class DriverSummaryDto
{
    public long Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public decimal Rating { get; set; }
    public int TotalRides { get; set; }
    public string? VehicleModel { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? VehicleColor { get; set; }
    public decimal? CurrentLatitude { get; set; }
    public decimal? CurrentLongitude { get; set; }
}

public class VerifyRideOtpRequest
{
    [Required]
    public string OtpCode { get; set; } = string.Empty;
}

public class CancelRideRequest
{
    public string? Reason { get; set; }
}

public class RateRideRequest
{
    [Range(1, 5)]
    public int Rating { get; set; } = 5;
    public string? Comment { get; set; }
}
