using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.Models;

public class Banner
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? ImageUrl { get; set; }
    
    [MaxLength(50)]
    public string? TargetType { get; set; }  // RESTAURANT, FOOD_ITEM, LISTING, URL
    
    [MaxLength(50)]
    public string? TargetId { get; set; }
    
    [MaxLength(20)]
    public string Module { get; set; } = "HOME";  // HOME, FOOD, RIDE, MARKETPLACE
    
    public int SortOrder { get; set; } = 0;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime? StartDate { get; set; }
    
    public DateTime? EndDate { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}
