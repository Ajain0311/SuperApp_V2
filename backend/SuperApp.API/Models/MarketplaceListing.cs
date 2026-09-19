using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class MarketplaceListing
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    public int CategoryId { get; set; }
    
    [ForeignKey(nameof(CategoryId))]
    public MarketplaceCategory Category { get; set; } = null!;
    
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(2000)]
    public string? Description { get; set; }
    
    [Column(TypeName = "decimal(12,2)")]
    public decimal Price { get; set; }
    
    [MaxLength(20)]
    public string Condition { get; set; } = "USED";  // NEW, LIKE_NEW, USED, FAIR
    
    [MaxLength(200)]
    public string? Location { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Latitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Longitude { get; set; }
    
    [MaxLength(20)]
    public string Status { get; set; } = ListingStatus.Active;
    
    public bool IsFeatured { get; set; } = false;
    
    public int ViewCount { get; set; } = 0;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<ListingImage> Images { get; set; } = new List<ListingImage>();
    public ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
}

public static class ListingStatus
{
    public const string Active = "ACTIVE";
    public const string Sold = "SOLD";
    public const string Expired = "EXPIRED";
    public const string Removed = "REMOVED";
    public const string Flagged = "FLAGGED";
}
