using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class FoodItemAddon
{
    [Key]
    public long Id { get; set; }
    
    public long FoodItemId { get; set; }
    
    [ForeignKey(nameof(FoodItemId))]
    public FoodItem FoodItem { get; set; } = null!;
    
    [Required, MaxLength(100)]
    public string GroupName { get; set; } = string.Empty;
    
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal Price { get; set; }
    
    public bool IsDefault { get; set; } = false;
    
    public bool IsActive { get; set; } = true;
    
    public int SortOrder { get; set; } = 0;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
