using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.Models;

public class OtpRequest
{
    [Key]
    public long Id { get; set; }
    
    [Required, MaxLength(15)]
    public string MobileNumber { get; set; } = string.Empty;
    
    [Required, MaxLength(10)]
    public string OtpCode { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string Purpose { get; set; } = "LOGIN";
    
    public bool IsUsed { get; set; } = false;
    
    public DateTime ExpiresAt { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public int AttemptCount { get; set; } = 0;
}
