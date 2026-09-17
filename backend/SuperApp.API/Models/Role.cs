using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.Models;

public class Role
{
    [Key]
    public int Id { get; set; }
    
    [Required, MaxLength(50)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string? Description { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public static class RoleNames
{
    public const string Customer = "CUSTOMER";
    public const string Admin = "ADMIN";
    public const string RestaurantOwner = "RESTAURANT_OWNER";
    public const string Driver = "DRIVER";
    public const string MarketplaceSeller = "MARKETPLACE_SELLER";
}
