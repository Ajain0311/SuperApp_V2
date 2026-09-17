using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Coupon
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string? Description { get; set; }
    
    [Required, MaxLength(20)]
    public string DiscountType { get; set; } = "PERCENTAGE";  // PERCENTAGE, FLAT
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal DiscountValue { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal MinOrderAmount { get; set; } = 0;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal? MaxDiscount { get; set; }
    
    public DateTime StartDate { get; set; }
    
    public DateTime ExpiryDate { get; set; }
    
    public int? TotalUsageLimit { get; set; }
    
    public int PerUserLimit { get; set; } = 1;
    
    public int CurrentUsageCount { get; set; } = 0;
    
    [MaxLength(20)]
    public string ApplicableModule { get; set; } = "FOOD";  // FOOD, RIDE, ALL
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<CouponUsage> Usages { get; set; } = new List<CouponUsage>();
}
