using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Favorite
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    public long ListingId { get; set; }
    
    [ForeignKey(nameof(ListingId))]
    public MarketplaceListing Listing { get; set; } = null!;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
