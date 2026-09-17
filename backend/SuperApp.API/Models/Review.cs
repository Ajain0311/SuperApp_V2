using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Review
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    [Required, MaxLength(20)]
    public string TargetType { get; set; } = string.Empty;  // RESTAURANT, DRIVER, LISTING
    
    public long TargetId { get; set; }
    
    public int Rating { get; set; }  // 1-5
    
    [MaxLength(1000)]
    public string? Comment { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
