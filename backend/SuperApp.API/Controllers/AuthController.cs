using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IOtpService _otpService;
    private readonly ITokenService _tokenService;
    private readonly IConfiguration _configuration;

    public AuthController(AppDbContext db, IOtpService otpService, ITokenService tokenService, IConfiguration configuration)
    {
        _db = db;
        _otpService = otpService;
        _tokenService = tokenService;
        _configuration = configuration;
    }

    /// <summary>
    /// Send OTP to mobile number. Creates user if not exists.
    /// </summary>
    /// <summary>
    /// Send OTP to mobile number. Creates user if not exists.
    /// </summary>
    [HttpPost("send-otp")]
    public async Task<ActionResult<SendOtpResponse>> SendOtp([FromBody] SendOtpRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new SendOtpResponse { Success = false, Message = "Invalid request" });

        var cleanMobile = BigBSmsService.NormalizeMobileNumber(request.MobileNumber);
        if (string.IsNullOrWhiteSpace(cleanMobile) || cleanMobile.Length < 10)
            return BadRequest(new SendOtpResponse { Success = false, Message = "Invalid mobile number" });

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber || u.MobileNumber == cleanMobile);

        bool isNewUser = user == null;
        bool isAdmin = user?.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin) ?? false;

        if (user != null && !user.IsActive)
            return BadRequest(new SendOtpResponse { Success = false, Message = "Account is deactivated. Please contact support." });

        // Generate OTP for both Citizen and Admin (Admin requires Password + OTP)
        string devOtp = await _otpService.GenerateAndSendOtpAsync(cleanMobile);
        var otpMode = Environment.GetEnvironmentVariable("OTP_MODE")
            ?? _configuration["Otp:Mode"]
            ?? (string.Equals(Environment.GetEnvironmentVariable("OTP_TEST_MODE"), "true", StringComparison.OrdinalIgnoreCase) ? "test" : null);
        var isTestMode = string.Equals(otpMode, "test", StringComparison.OrdinalIgnoreCase);
        var otpProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER") ?? "Mock";
        bool isRealSms = otpProvider.Equals("BIGB", StringComparison.OrdinalIgnoreCase) && !isTestMode;
        var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase) && !isTestMode;

        return Ok(new SendOtpResponse
        {
            Success = true,
            Message = isAdmin
                ? "Admin detected. Password and OTP verification required."
                : "OTP sent successfully to your mobile number",
            IsNewUser = isNewUser,
            IsAdmin = isAdmin,
            DevOtp = (isProd || isRealSms) ? null : devOtp
        });
    }

    /// <summary>
    /// Verify OTP for normal Citizen user login/registration.
    /// </summary>
    [HttpPost("verify-otp")]
    public async Task<ActionResult<AuthResponse>> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid request" });

        var cleanMobile = BigBSmsService.NormalizeMobileNumber(request.MobileNumber);
        var isValid = await _otpService.VerifyOtpAsync(cleanMobile, request.OtpCode);
        if (!isValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid or expired OTP" });

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber || u.MobileNumber == cleanMobile);

        if (user == null)
        {
            // New user registration
            user = new User
            {
                MobileNumber = cleanMobile,
                FullName = request.FullName,
                CreatedAt = DateTime.UtcNow,
                LastLoginAt = DateTime.UtcNow
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            // Assign CUSTOMER role
            var customerRole = await _db.Roles.FirstAsync(r => r.Name == RoleNames.Customer);
            _db.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                RoleId = customerRole.Id
            });
            await _db.SaveChangesAsync();

            // Reload with roles
            user = await _db.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstAsync(u => u.Id == user.Id);
        }
        else
        {
            // Check if user is admin - admins must use the admin-login endpoint with Password + OTP
            if (user.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin))
                return BadRequest(new AuthResponse { Success = false, Message = "Admin users must use the admin login endpoint with Password & OTP" });

            if (!user.IsActive)
                return BadRequest(new AuthResponse { Success = false, Message = "Account is deactivated" });

            user.LastLoginAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        // Explicit source of truth: Only sync RESTAURANT_OWNER role if active, admin-approved mapping exists in RestaurantUsers
        var hasActiveRestaurantMapping = await _db.RestaurantUsers
            .AnyAsync(ru => ru.UserId == user.Id && ru.IsActive && ru.Restaurant.IsActive);
        if (hasActiveRestaurantMapping)
        {
            var ownerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.RestaurantOwner);
            if (ownerRole != null && !user.UserRoles.Any(ur => ur.RoleId == ownerRole.Id))
            {
                _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = ownerRole.Id, CreatedAt = DateTime.UtcNow });
                await _db.SaveChangesAsync();
                user = await _db.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .FirstAsync(u => u.Id == user.Id);
            }
        }
        else
        {
            // If user has RESTAURANT_OWNER role but no active mapping in RestaurantUsers, revoke stale role
            var staleOwnerRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Name == RoleNames.RestaurantOwner);
            if (staleOwnerRole != null)
            {
                _db.UserRoles.Remove(staleOwnerRole);
                await _db.SaveChangesAsync();
                user = await _db.Users
                    .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                    .FirstAsync(u => u.Id == user.Id);
            }
        }

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var token = _tokenService.GenerateToken(user, roles);

        return Ok(new AuthResponse
        {
            Success = true,
            Message = "Login successful",
            Token = token,
            User = MapToUserDto(user)
        });
    }

    /// <summary>
    /// Admin login requiring both Password and OTP.
    /// </summary>
    [HttpPost("admin-login")]
    public async Task<ActionResult<AuthResponse>> AdminLogin([FromBody] AdminLoginRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid request" });

        if (string.IsNullOrWhiteSpace(request.OtpCode))
            return BadRequest(new AuthResponse { Success = false, Message = "OTP code is required for admin authentication" });

        var cleanMobile = BigBSmsService.NormalizeMobileNumber(request.MobileNumber);

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber || u.MobileNumber == cleanMobile);

        if (user == null)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid credentials" });

        if (!user.IsActive)
            return BadRequest(new AuthResponse { Success = false, Message = "Account is deactivated" });

        // Check admin role
        if (!user.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin))
            return BadRequest(new AuthResponse { Success = false, Message = "Access denied. User is not an admin." });

        // 1. Verify Password
        bool isPasswordValid = false;
        if (!string.IsNullOrEmpty(user.PasswordHash))
        {
            try
            {
                isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            }
            catch
            {
                isPasswordValid = false;
            }
        }

        if (!isPasswordValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid password" });

        // 2. Verify OTP
        var isOtpValid = await _otpService.VerifyOtpAsync(cleanMobile, request.OtpCode);
        if (!isOtpValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid or expired OTP" });

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Ensure admin user also has CUSTOMER role for Citizen mode switching
        var customerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.Customer);
        if (customerRole != null && !user.UserRoles.Any(ur => ur.RoleId == customerRole.Id))
        {
            _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = customerRole.Id, CreatedAt = DateTime.UtcNow });
            await _db.SaveChangesAsync();
            user = await _db.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstAsync(u => u.Id == user.Id);
        }

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var token = _tokenService.GenerateToken(user, roles);

        return Ok(new AuthResponse
        {
            Success = true,
            Message = "Admin login successful",
            Token = token,
            User = MapToUserDto(user)
        });
    }

    /// <summary>
    /// Send OTP for password reset (Admin only).
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<ActionResult<SendOtpResponse>> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new SendOtpResponse { Success = false, Message = "Invalid request" });

        var cleanMobile = BigBSmsService.NormalizeMobileNumber(request.MobileNumber);

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber || u.MobileNumber == cleanMobile);

        if (user == null || !user.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin))
            return BadRequest(new SendOtpResponse { Success = false, Message = "Admin account not found" });

        if (!user.IsActive)
            return BadRequest(new SendOtpResponse { Success = false, Message = "Account is deactivated" });

        string devOtp = await _otpService.GenerateAndSendOtpAsync(cleanMobile);
        var otpMode = Environment.GetEnvironmentVariable("OTP_MODE")
            ?? _configuration["Otp:Mode"]
            ?? (string.Equals(Environment.GetEnvironmentVariable("OTP_TEST_MODE"), "true", StringComparison.OrdinalIgnoreCase) ? "test" : null);
        var isTestMode = string.Equals(otpMode, "test", StringComparison.OrdinalIgnoreCase);
        var otpProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER") ?? "Mock";
        bool isRealSms = otpProvider.Equals("BIGB", StringComparison.OrdinalIgnoreCase) && !isTestMode;
        var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase) && !isTestMode;

        return Ok(new SendOtpResponse
        {
            Success = true,
            Message = "OTP sent successfully for password reset",
            IsAdmin = true,
            DevOtp = (isProd || isRealSms) ? null : devOtp
        });
    }

    /// <summary>
    /// Verify OTP and reset admin password.
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<ActionResult<AuthResponse>> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid request" });

        var cleanMobile = BigBSmsService.NormalizeMobileNumber(request.MobileNumber);

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber || u.MobileNumber == cleanMobile);

        if (user == null || !user.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin))
            return BadRequest(new AuthResponse { Success = false, Message = "Admin account not found" });

        var isOtpValid = await _otpService.VerifyOtpAsync(cleanMobile, request.OtpCode);
        if (!isOtpValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid or expired OTP" });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new AuthResponse
        {
            Success = true,
            Message = "Password reset successfully. You can now login with your new password."
        });
    }

    /// <summary>
    /// Get current user profile.
    /// </summary>
    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetProfile()
    {
        var userId = long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        
        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return NotFound(ApiResponse<UserDto>.Fail("User not found"));

        return Ok(ApiResponse<UserDto>.Ok(MapToUserDto(user)));
    }

    /// <summary>
    /// Update current user profile.
    /// </summary>
    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<UserDto>>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = long.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        
        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return NotFound(ApiResponse<UserDto>.Fail("User not found"));

        if (request.FullName != null)
        {
            var name = request.FullName.Trim();
            if (string.IsNullOrWhiteSpace(name) || name.Length < 2)
                return BadRequest(ApiResponse<UserDto>.Fail("Full name must be at least 2 characters"));
            if (name.Length > 100)
                return BadRequest(ApiResponse<UserDto>.Fail("Full name must be 100 characters or fewer"));
            user.FullName = name;
        }
        if (request.Email != null)
            user.Email = request.Email;
        if (request.ProfileImageUrl != null)
            user.ProfileImageUrl = request.ProfileImageUrl;
        
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<UserDto>.Ok(MapToUserDto(user), "Profile updated"));
    }

    private static UserDto MapToUserDto(User user) => new()
    {
        Id = user.Id,
        MobileNumber = user.MobileNumber,
        FullName = user.FullName,
        Email = user.Email,
        ProfileImageUrl = user.ProfileImageUrl,
        Roles = user.UserRoles.Select(ur => ur.Role.Name).ToList()
    };
}
