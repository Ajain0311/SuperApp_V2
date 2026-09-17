using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Vehicle
{
    [Key]
    public long Id { get; set; }
    
    public long DriverId { get; set; }
    
    [ForeignKey(nameof(DriverId))]
    public Driver Driver { get; set; } = null!;
    
    [Required, MaxLength(20)]
    public string Type { get; set; } = string.Empty;  // BIKE, AUTO, CAB
    
    [MaxLength(100)]
    public string? Make { get; set; }
    
    [MaxLength(100)]
    public string? Model { get; set; }
    
    public int? Year { get; set; }
    
    [Required, MaxLength(20)]
    public string RegistrationNumber { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string? Color { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}

public static class VehicleTypes
{
    public const string Bike = "BIKE";
    public const string Auto = "AUTO";
    public const string Cab = "CAB";
}
