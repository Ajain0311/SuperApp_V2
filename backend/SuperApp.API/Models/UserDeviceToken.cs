using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class UserDeviceToken
{
    [Key]
    public long Id { get; set; }

    public long UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;

    [Required, MaxLength(500)]
    public string DeviceToken { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Platform { get; set; } = "expo";

    [MaxLength(100)]
    public string? DeviceType { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
