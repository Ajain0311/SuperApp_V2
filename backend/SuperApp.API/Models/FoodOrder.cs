using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class FoodOrder
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(20)]
    public string OrderNumber { get; set; } = string.Empty;
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    public long RestaurantId { get; set; }
    
    [ForeignKey(nameof(RestaurantId))]
    public Restaurant Restaurant { get; set; } = null!;
    
    public long? AddressId { get; set; }
    
    [ForeignKey(nameof(AddressId))]
    public Address? Address { get; set; }
    
    [Required, MaxLength(20)]
    public string Status { get; set; } = OrderStatus.Pending;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal SubTotal { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal DiscountAmount { get; set; } = 0;
    
    public long? CouponId { get; set; }
    
    [ForeignKey(nameof(CouponId))]
    public Coupon? Coupon { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal CouponDiscount { get; set; } = 0;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal DeliveryFee { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal TaxAmount { get; set; } = 0;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal GrandTotal { get; set; }
    
    [MaxLength(20)]
    public string? PaymentMethod { get; set; }
    
    [MaxLength(20)]
    public string PaymentStatus { get; set; } = "PENDING";
    
    [MaxLength(500)]
    public string? Notes { get; set; }
    
    public int? EstimatedDeliveryMinutes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<FoodOrderItem> Items { get; set; } = new List<FoodOrderItem>();
}

public static class OrderStatus
{
    public const string Pending = "PENDING";
    public const string Accepted = "ACCEPTED";
    public const string Preparing = "PREPARING";
    public const string Ready = "READY";
    public const string PickedUp = "PICKED_UP";
    public const string Delivered = "DELIVERED";
    public const string Cancelled = "CANCELLED";
}
