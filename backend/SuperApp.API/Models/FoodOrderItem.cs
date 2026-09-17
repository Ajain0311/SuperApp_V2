using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class FoodOrderItem
{
    [Key]
    public long Id { get; set; }
    
    public long FoodOrderId { get; set; }
    
    [ForeignKey(nameof(FoodOrderId))]
    public FoodOrder FoodOrder { get; set; } = null!;
    
    public long FoodItemId { get; set; }
    
    [ForeignKey(nameof(FoodItemId))]
    public FoodItem FoodItem { get; set; } = null!;
    
    [Required, MaxLength(200)]
    public string ItemName { get; set; } = string.Empty;
    
    public int Quantity { get; set; } = 1;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal UnitPrice { get; set; }
    
    [MaxLength(200)]
    public string? VariantName { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal VariantPrice { get; set; } = 0;
    
    [MaxLength(2000)]
    public string? AddonsJson { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal TotalPrice { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
