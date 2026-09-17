using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class RestaurantCategory
{
    [Key]
    public long Id { get; set; }
    
    public long RestaurantId { get; set; }
    
    [ForeignKey(nameof(RestaurantId))]
    public Restaurant Restaurant { get; set; } = null!;
    
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string? Description { get; set; }
    
    public int SortOrder { get; set; } = 0;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<FoodItem> FoodItems { get; set; } = new List<FoodItem>();
}
