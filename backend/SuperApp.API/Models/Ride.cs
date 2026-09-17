using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Ride
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(20)]
    public string RideNumber { get; set; } = string.Empty;
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    public long? DriverId { get; set; }
    
    [ForeignKey(nameof(DriverId))]
    public Driver? Driver { get; set; }
    
    public long? VehicleId { get; set; }
    
    [ForeignKey(nameof(VehicleId))]
    public Vehicle? Vehicle { get; set; }
    
    [Required, MaxLength(20)]
    public string VehicleType { get; set; } = string.Empty;
    
    [Required, MaxLength(500)]
    public string PickupAddress { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal PickupLatitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal PickupLongitude { get; set; }
    
    [Required, MaxLength(500)]
    public string DropoffAddress { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal DropoffLatitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal DropoffLongitude { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal? DistanceKm { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal EstimatedFare { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal? ActualFare { get; set; }
    
    [Required, MaxLength(20)]
    public string Status { get; set; } = RideStatus.Requested;
    
    [MaxLength(10)]
    public string? OtpCode { get; set; }
    
    [MaxLength(20)]
    public string? PaymentMethod { get; set; }
    
    [MaxLength(20)]
    public string? PaymentStatus { get; set; }
    
    public DateTime? StartedAt { get; set; }
    
    public DateTime? CompletedAt { get; set; }
    
    public DateTime? CancelledAt { get; set; }
    
    [MaxLength(500)]
    public string? CancellationReason { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}

public static class RideStatus
{
    public const string Requested = "REQUESTED";
    public const string Assigned = "ASSIGNED";
    public const string Accepted = "ACCEPTED";
    public const string Arriving = "ARRIVING";
    public const string Started = "STARTED";
    public const string Completed = "COMPLETED";
    public const string Cancelled = "CANCELLED";
}
