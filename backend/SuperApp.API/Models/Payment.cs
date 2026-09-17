using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Payment
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    [Required, MaxLength(20)]
    public string Module { get; set; } = string.Empty;  // FOOD, RIDE
    
    public long OrderId { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; }
    
    [Required, MaxLength(20)]
    public string PaymentMethod { get; set; } = string.Empty;  // COD, UPI, CARD, WALLET
    
    [MaxLength(100)]
    public string? TransactionId { get; set; }
    
    [Required, MaxLength(20)]
    public string Status { get; set; } = "PENDING";  // PENDING, COMPLETED, FAILED, REFUNDED
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}
