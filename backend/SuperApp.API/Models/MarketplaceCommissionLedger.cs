using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class MarketplaceCommissionLedger
{
    [Key]
    public long Id { get; set; }

    public long ListingId { get; set; }

    [ForeignKey(nameof(ListingId))]
    public MarketplaceListing Listing { get; set; } = null!;

    public long SellerId { get; set; }

    [ForeignKey(nameof(SellerId))]
    public User Seller { get; set; } = null!;

    [Column(TypeName = "decimal(12,2)")]
    public decimal SoldPrice { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal CommissionRatePercent { get; set; }

    [Column(TypeName = "decimal(12,2)")]
    public decimal CommissionAmount { get; set; }

    [Column(TypeName = "decimal(12,2)")]
    public decimal NetSellerProceeds { get; set; }

    /// <summary>PENDING, SETTLED, WAIVED</summary>
    [MaxLength(20)]
    public string Status { get; set; } = "PENDING";

    public long? SettlementBatchId { get; set; }

    [MaxLength(100)]
    public string? ReferenceProof { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? SettledAt { get; set; }
}
