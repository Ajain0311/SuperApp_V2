using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class FoodItem
{
    [Key]
    public long Id { get; set; }
    
    public long RestaurantCategoryId { get; set; }
    
    [ForeignKey(nameof(RestaurantCategoryId))]
    public RestaurantCategory RestaurantCategory { get; set; } = null!;
    
    public long RestaurantId { get; set; }
    
    [ForeignKey(nameof(RestaurantId))]
    public Restaurant Restaurant { get; set; } = null!;
    
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    [MaxLength(500)]
    public string? ImageUrl { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal BasePrice { get; set; }
    
    [Column(TypeName = "decimal(5,2)")]
    public decimal DiscountPercent { get; set; } = 0;
    
    public bool IsVeg { get; set; } = true;
    
    public bool IsAvailable { get; set; } = true;
    
    public bool IsBestseller { get; set; } = false;
    
    public bool IsCustomizable { get; set; } = false;
    
    public int SortOrder { get; set; } = 0;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Computed property (not stored, calculated in code)
    [NotMapped]
    public decimal DiscountedPrice => DiscountPercent > 0 
        ? Math.Round(BasePrice * (1 - DiscountPercent / 100), 2) 
        : BasePrice;
    
    // Navigation
    public ICollection<FoodItemAddon> Addons { get; set; } = new List<FoodItemAddon>();
    public ICollection<FoodItemVariant> Variants { get; set; } = new List<FoodItemVariant>();
}
