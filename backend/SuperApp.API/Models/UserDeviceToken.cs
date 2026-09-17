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

    // Maps to expo_push_token column in Supabase schema
    [Required, MaxLength(500), Column("expo_push_token")]
    public string DeviceToken { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Platform { get; set; } = "expo";

    // Maps to device_name column in Supabase schema
    [MaxLength(100), Column("device_name")]
    public string? DeviceType { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}

