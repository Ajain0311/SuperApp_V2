using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Restaurant
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    [MaxLength(500)]
    public string? ImageUrl { get; set; }
    
    [MaxLength(15)]
    public string? Phone { get; set; }
    
    [MaxLength(255)]
    public string? Email { get; set; }
    
    [MaxLength(500)]
    public string? AddressLine { get; set; }
    
    [MaxLength(100)]
    public string? City { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Latitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Longitude { get; set; }
    
    [Column(TypeName = "decimal(3,2)")]
    public decimal Rating { get; set; } = 0;
    
    public int TotalRatings { get; set; } = 0;
    
    public bool IsVeg { get; set; } = false;
    
    public TimeSpan? OpeningTime { get; set; }
    
    public TimeSpan? ClosingTime { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal MinOrderAmount { get; set; } = 0;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal DeliveryFee { get; set; } = 0;
    
    public int AvgDeliveryTimeMinutes { get; set; } = 30;
    
    public bool IsActive { get; set; } = true;
    
    public bool IsFeatured { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<RestaurantUser> RestaurantUsers { get; set; } = new List<RestaurantUser>();
    public ICollection<RestaurantCategory> Categories { get; set; } = new List<RestaurantCategory>();
    public ICollection<FoodItem> FoodItems { get; set; } = new List<FoodItem>();
    public ICollection<FoodOrder> FoodOrders { get; set; } = new List<FoodOrder>();
}
