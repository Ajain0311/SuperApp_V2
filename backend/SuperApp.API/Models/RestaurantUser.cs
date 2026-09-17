using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class RestaurantUser
{
    [Key]
    public long Id { get; set; }
    
    public long RestaurantId { get; set; }
    
    [ForeignKey(nameof(RestaurantId))]
    public Restaurant Restaurant { get; set; } = null!;
    
    public long UserId { get; set; }
    
    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
