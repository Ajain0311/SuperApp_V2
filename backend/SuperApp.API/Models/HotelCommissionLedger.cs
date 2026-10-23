using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class HotelCommissionLedger
{
    [Key]
    public long Id { get; set; }

    public long RestaurantId { get; set; }

    [ForeignKey(nameof(RestaurantId))]
    public Restaurant Restaurant { get; set; } = null!;

    public long FoodOrderId { get; set; }

    [ForeignKey(nameof(FoodOrderId))]
    public FoodOrder FoodOrder { get; set; } = null!;

    [Required, MaxLength(30)]
    public string OrderNumber { get; set; } = string.Empty;

    /// <summary>Subtotal of food items after hotel-level discounts, excluding tax and delivery fee.</summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal CommissionBaseAmount { get; set; }

    /// <summary>Rate snapshotted at confirmation time, e.g. 15.00 for 15%.</summary>
    [Column(TypeName = "decimal(5,2)")]
    public decimal CommissionRatePercent { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal CommissionAmount { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal NetHotelProceeds { get; set; }

    /// <summary>Platform-funded discount (coupon) tracked separately so it does not reduce hotel proceeds.</summary>
    [Column(TypeName = "decimal(10,2)")]
    public decimal PlatformFundedDiscount { get; set; } = 0;

    /// <summary>Status: PENDING, SETTLED.</summary>
    [Required, MaxLength(20)]
    public string Status { get; set; } = "PENDING";

    public long? SettlementBatchId { get; set; }

    [ForeignKey(nameof(SettlementBatchId))]
    public HotelSettlementBatch? SettlementBatch { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SettledAt { get; set; }
}

public class HotelSettlementBatch
{
    [Key]
    public long Id { get; set; }

    [Required, MaxLength(40)]
    public string BatchNumber { get; set; } = string.Empty;

    public long RestaurantId { get; set; }

    [ForeignKey(nameof(RestaurantId))]
    public Restaurant Restaurant { get; set; } = null!;

    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }

    public int OrderCount { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal TotalCommissionAmount { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal TotalSettledAmount { get; set; }

    [MaxLength(100)]
    public string? ReferenceProof { get; set; }

    public long? ApprovedByAdminId { get; set; }

    [ForeignKey(nameof(ApprovedByAdminId))]
    public User? ApprovedByAdmin { get; set; }

    [MaxLength(100)]
    public string? ApprovedByAdminName { get; set; }

    /// <summary>PENDING_APPROVAL, APPROVED, REJECTED</summary>
    [Required, MaxLength(20)]
    public string Status { get; set; } = "PENDING_APPROVAL";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }

    public ICollection<HotelCommissionLedger> LedgerEntries { get; set; } = new List<HotelCommissionLedger>();
}
