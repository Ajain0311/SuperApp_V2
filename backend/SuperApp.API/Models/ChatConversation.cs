using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class ChatConversation
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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
