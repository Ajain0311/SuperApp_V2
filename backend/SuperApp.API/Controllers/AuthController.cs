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

    public AuthController(AppDbContext db, IOtpService otpService, ITokenService tokenService)
    {
        _db = db;
        _otpService = otpService;
        _tokenService = tokenService;
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

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber);

        bool isNewUser = user == null;
        bool isAdmin = user?.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin) ?? false;

        if (user != null && !user.IsActive)
            return BadRequest(new SendOtpResponse { Success = false, Message = "Account is deactivated. Please contact support." });

        // Generate OTP for both Citizen and Admin (Admin requires Password + OTP)
        string devOtp = await _otpService.GenerateAndSendOtpAsync(request.MobileNumber);

        return Ok(new SendOtpResponse
        {
            Success = true,
            Message = isAdmin
                ? "Admin detected. Password and OTP verification required."
                : "OTP sent successfully",
            IsNewUser = isNewUser,
            IsAdmin = isAdmin,
            DevOtp = devOtp // Testing only — remove in production SMS flow
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

        var isValid = await _otpService.VerifyOtpAsync(request.MobileNumber, request.OtpCode);
        if (!isValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid or expired OTP" });

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber);

        if (user == null)
        {
            // New user registration
            user = new User
            {
                MobileNumber = request.MobileNumber,
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

        var user = await _db.Users
            .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.MobileNumber == request.MobileNumber);

        if (user == null)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid credentials" });

        if (!user.IsActive)
            return BadRequest(new AuthResponse { Success = false, Message = "Account is deactivated" });

        // Check admin role
        if (!user.UserRoles.Any(ur => ur.Role.Name == RoleNames.Admin))
            return BadRequest(new AuthResponse { Success = false, Message = "Access denied. User is not an admin." });

        // 1. Verify Password
        if (string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid password" });

        // 2. Verify OTP
        var isOtpValid = await _otpService.VerifyOtpAsync(request.MobileNumber, request.OtpCode);
        if (!isOtpValid)
            return BadRequest(new AuthResponse { Success = false, Message = "Invalid or expired OTP" });

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

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
            user.FullName = request.FullName;
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
