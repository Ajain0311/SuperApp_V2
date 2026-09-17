using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class ListingImage
{
    [Key]
    public long Id { get; set; }
    
    public long ListingId { get; set; }
    
    [ForeignKey(nameof(ListingId))]
    public MarketplaceListing Listing { get; set; } = null!;
    
    [Required, MaxLength(500)]
    public string ImageUrl { get; set; } = string.Empty;
    
    public int SortOrder { get; set; } = 0;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
