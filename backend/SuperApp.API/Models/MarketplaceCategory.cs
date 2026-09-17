using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.Models;

public class MarketplaceCategory
{
    [Key]
    public int Id { get; set; }
    
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? IconUrl { get; set; }
    
    public int SortOrder { get; set; } = 0;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<MarketplaceListing> Listings { get; set; } = new List<MarketplaceListing>();
}
