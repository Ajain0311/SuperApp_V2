using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Driver
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    [MaxLength(50)]
    public string? LicenseNumber { get; set; }
    
    public bool IsVerified { get; set; } = false;
    
    public bool IsOnline { get; set; } = false;
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? CurrentLatitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? CurrentLongitude { get; set; }
    
    [Column(TypeName = "decimal(3,2)")]
    public decimal Rating { get; set; } = 0;
    
    public int TotalRides { get; set; } = 0;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<Ride> Rides { get; set; } = new List<Ride>();
}
