using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class CouponUsage
{
    [Key]
    public long Id { get; set; }
    
    public long CouponId { get; set; }
    
    [ForeignKey(nameof(CouponId))]
    public Coupon Coupon { get; set; } = null!;
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    public long? OrderId { get; set; }
    
    public DateTime UsedAt { get; set; } = DateTime.UtcNow;
}
