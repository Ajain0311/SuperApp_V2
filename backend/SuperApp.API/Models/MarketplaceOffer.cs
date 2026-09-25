using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class MarketplaceOffer
{
    [Key]
    public long Id { get; set; }

    public long ListingId { get; set; }

    [ForeignKey(nameof(ListingId))]
    public MarketplaceListing Listing { get; set; } = null!;

    public long BuyerId { get; set; }

    [ForeignKey(nameof(BuyerId))]
    public User Buyer { get; set; } = null!;

    public long SellerId { get; set; }

    [ForeignKey(nameof(SellerId))]
    public User Seller { get; set; } = null!;

    [Column(TypeName = "decimal(12,2)")]
    public decimal OfferedPrice { get; set; }

    [MaxLength(500)]
    public string? Message { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = OfferStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}

public static class OfferStatus
{
    public const string Pending = "PENDING";
    public const string Accepted = "ACCEPTED";
    public const string Rejected = "REJECTED";
    public const string Cancelled = "CANCELLED";
}
