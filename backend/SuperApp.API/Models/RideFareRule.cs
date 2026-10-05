using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class RideFareRule
{
    [Key]
    public long Id { get; set; }

    [Required, MaxLength(20)]
    public string VehicleType { get; set; } = string.Empty;

    [MaxLength(40)]
    public string City { get; set; } = "DEFAULT";

    [Column(TypeName = "decimal(10,2)")]
    public decimal MinimumFare { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal BaseFare { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal IncludedDistanceKm { get; set; }

    [Column(TypeName = "decimal(8,2)")]
    public decimal PerKmRate { get; set; }

    [Column(TypeName = "decimal(8,2)")]
    public decimal PerMinuteRate { get; set; }

    [Column(TypeName = "decimal(8,2)")]
    public decimal BookingFee { get; set; }

    [Column(TypeName = "decimal(8,2)")]
    public decimal PlatformFee { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal NightSurchargePercent { get; set; }

    [Column(TypeName = "decimal(6,2)")]
    public decimal PeakMultiplier { get; set; } = 1m;

    [Column(TypeName = "decimal(6,2)")]
    public decimal TaxPercentage { get; set; }

    public bool IsActive { get; set; } = true;
}

public class RideFareOption
{
    [Key]
    public long Id { get; set; }

    [Required, MaxLength(40)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(80)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    [Column(TypeName = "decimal(8,2)")]
    public decimal AdditionalAmount { get; set; }

    public bool IsEnabled { get; set; } = true;

    [MaxLength(80)]
    public string VehicleTypes { get; set; } = "ALL";
}
