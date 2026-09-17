using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Address
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    [MaxLength(50)]
    public string? Label { get; set; }  // Home, Work, Other
    
    [Required, MaxLength(255)]
    public string AddressLine1 { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string? AddressLine2 { get; set; }
    
    [Required, MaxLength(100)]
    public string City { get; set; } = string.Empty;
    
    [Required, MaxLength(100)]
    public string State { get; set; } = string.Empty;
    
    [Required, MaxLength(10)]
    public string PinCode { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Latitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Longitude { get; set; }
    
    public bool IsDefault { get; set; } = false;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}
