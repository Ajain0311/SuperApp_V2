using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class Notification
{
    [Key]
    public long Id { get; set; }
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Body { get; set; }
    
    [MaxLength(50)]
    public string? Type { get; set; }  // ORDER, RIDE, MARKETPLACE, PROMO, SYSTEM
    
    [MaxLength(50)]
    public string? ReferenceId { get; set; }
    
    public bool IsRead { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
