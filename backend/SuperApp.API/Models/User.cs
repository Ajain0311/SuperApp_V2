using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class User
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(15)]
    public string MobileNumber { get; set; } = string.Empty;
    
    [MaxLength(100)]
    public string? FullName { get; set; }
    
    [MaxLength(255)]
    public string? Email { get; set; }
    
    [MaxLength(500)]
    public string? ProfileImageUrl { get; set; }
    
    [MaxLength(255)]
    public string? PasswordHash { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    public DateTime? LastLoginAt { get; set; }
    
    // Navigation
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<Address> Addresses { get; set; } = new List<Address>();
    public ICollection<RestaurantUser> RestaurantUsers { get; set; } = new List<RestaurantUser>();
}
