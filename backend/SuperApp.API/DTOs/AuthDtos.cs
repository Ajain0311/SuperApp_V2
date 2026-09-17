using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.DTOs;

// --- Auth DTOs ---

public class SendOtpRequest
{
    [Required]
    [Phone]
    [MaxLength(15)]
    public string MobileNumber { get; set; } = string.Empty;
}

public class SendOtpResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsNewUser { get; set; }
    public bool IsAdmin { get; set; }
    public string? DevOtp { get; set; } // Only in development
}

public class VerifyOtpRequest
{
    [Required]
    [Phone]
    [MaxLength(15)]
    public string MobileNumber { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(10)]
    public string OtpCode { get; set; } = string.Empty;
    
    [MaxLength(100)]
    public string? FullName { get; set; } // For new user registration
}

public class AdminLoginRequest
{
    [Required]
    [Phone]
    [MaxLength(15)]
    public string MobileNumber { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(255)]
    public string Password { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(10)]
    public string OtpCode { get; set; } = string.Empty;
}

public class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Token { get; set; }
    public UserDto? User { get; set; }
}

public class UserDto
{
    public long Id { get; set; }
    public string MobileNumber { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? ProfileImageUrl { get; set; }
    public List<string> Roles { get; set; } = new();
}

public class UpdateProfileRequest
{
    [MaxLength(100)]
    public string? FullName { get; set; }
    
    [MaxLength(255)]
    [EmailAddress]
    public string? Email { get; set; }
    
    [MaxLength(500)]
    public string? ProfileImageUrl { get; set; }
}
