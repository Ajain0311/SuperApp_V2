using Microsoft.EntityFrameworkCore;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class AuthTests
{
    [Fact]
    public void BCrypt_HashPassword_VerifiesCorrectly()
    {
        // Arrange
        var password = "Admin@SecurePassword123";

        // Act
        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var isValid = BCrypt.Net.BCrypt.Verify(password, hash);
        var isInvalid = BCrypt.Net.BCrypt.Verify("WrongPassword", hash);

        // Assert
        Assert.True(isValid);
        Assert.False(isInvalid);
    }



    [Theory]
    [InlineData("CUSTOMER")]
    [InlineData("ADMIN")]
    [InlineData("RESTAURANT_OWNER")]
    [InlineData("DRIVER")]
    [InlineData("MARKETPLACE_SELLER")]
    public void RoleNames_Constants_AreValid(string roleName)
    {
        Assert.Contains(roleName, new[]
        {
            RoleNames.Customer,
            RoleNames.Admin,
            RoleNames.RestaurantOwner,
            RoleNames.Driver,
            RoleNames.MarketplaceSeller
        });
    }

    [Fact]
    public async Task MockOtpService_Accepts_GeneratedRandomOtp()
    {
        var origProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER");
        try
        {
            Environment.SetEnvironmentVariable("OTP_PROVIDER", "Mock");
            // Arrange
            var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new SuperApp.API.Data.AppDbContext(options);
            var otpService = new MockOtpService(db);
            var phone = "9876543210";

            // Act
            var otp = await otpService.GenerateAndSendOtpAsync(phone, "LOGIN");
            var isInvalid = await otpService.VerifyOtpAsync(phone, "000000", "LOGIN");
            var isValid = await otpService.VerifyOtpAsync(phone, otp, "LOGIN");

            // Assert
            Assert.Equal(6, otp.Length);
            Assert.True(int.TryParse(otp, out _));
            Assert.False(isInvalid);
            Assert.True(isValid);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OTP_PROVIDER", origProvider);
        }
    }

    [Fact]
    public void MockOtpService_ThrowsException_InProduction()
    {
        var origProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER");
        var origEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        try
        {
            Environment.SetEnvironmentVariable("OTP_PROVIDER", "Mock");
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");

            var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new SuperApp.API.Data.AppDbContext(options);

            Assert.Throws<InvalidOperationException>(() => new MockOtpService(db));
        }
        finally
        {
            Environment.SetEnvironmentVariable("OTP_PROVIDER", origProvider);
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", origEnv);
        }
    }

    [Fact]
    public void MockOtpService_ThrowsException_WhenProviderIsNotMock()
    {
        var origProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER");
        try
        {
            Environment.SetEnvironmentVariable("OTP_PROVIDER", "PunjabGov");
            var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new SuperApp.API.Data.AppDbContext(options);

            Assert.Throws<InvalidOperationException>(() => new MockOtpService(db));
        }
        finally
        {
            Environment.SetEnvironmentVariable("OTP_PROVIDER", origProvider);
        }
    }

    [Fact]
    public async Task AdminLogin_WithAdmin123_FailsWhenPasswordDoesNotMatch()
    {
        // Regression test verifying removal of hardcoded Admin@123 backdoor
        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        using var db = new SuperApp.API.Data.AppDbContext(options);

        var adminRole = new Role { Id = 1, Name = RoleNames.Admin };
        db.Roles.Add(adminRole);

        var adminUser = new User
        {
            Id = 10,
            MobileNumber = "9876543210",
            FullName = "Legit Admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("RealStrongPassword!2026"),
            IsActive = true
        };
        db.Users.Add(adminUser);
        db.UserRoles.Add(new UserRole { UserId = 10, RoleId = 1 });
        await db.SaveChangesAsync();

        var otpService = new MockOtpService(db);
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var tokenService = new TokenService(config);
        var controller = new SuperApp.API.Controllers.AuthController(db, otpService, tokenService);

        var result = await controller.AdminLogin(new SuperApp.API.DTOs.AdminLoginRequest
        {
            MobileNumber = "9876543210",
            Password = "Admin@123", // Backdoor attempt
            OtpCode = "123456"
        });

        var badReq = Assert.IsType<Microsoft.AspNetCore.Mvc.BadRequestObjectResult>(result.Result);
        var res = Assert.IsType<SuperApp.API.DTOs.AuthResponse>(badReq.Value);
        Assert.False(res.Success);
        Assert.Equal("Invalid password", res.Message);

        // Verify password hash in DB was NOT overwritten
        var freshUser = await db.Users.FindAsync((long)10);
        Assert.True(BCrypt.Net.BCrypt.Verify("RealStrongPassword!2026", freshUser!.PasswordHash));
        Assert.False(BCrypt.Net.BCrypt.Verify("Admin@123", freshUser!.PasswordHash));
    }

    [Fact]
    public async Task SendOtp_InProduction_NeverReturnsDevOtp()
    {
        var origEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var origProvider = Environment.GetEnvironmentVariable("OTP_PROVIDER");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");
            Environment.SetEnvironmentVariable("OTP_PROVIDER", "PunjabGov");

            var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new SuperApp.API.Data.AppDbContext(options);

            var fakeOtpService = new MockOtpServiceForProdTest();
            var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
            var tokenService = new TokenService(config);
            var controller = new SuperApp.API.Controllers.AuthController(db, fakeOtpService, tokenService);

            var result = await controller.SendOtp(new SuperApp.API.DTOs.SendOtpRequest
            {
                MobileNumber = "9876543210"
            });

            var okResult = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(result.Result);
            var res = Assert.IsType<SuperApp.API.DTOs.SendOtpResponse>(okResult.Value);
            Assert.True(res.Success);
            Assert.Null(res.DevOtp); // Must be strictly null in Production
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", origEnv);
            Environment.SetEnvironmentVariable("OTP_PROVIDER", origProvider);
        }
    }

    private class MockOtpServiceForProdTest : IOtpService
    {
        public Task<string> GenerateAndSendOtpAsync(string mobileNumber, string purpose = "LOGIN") => Task.FromResult("999888");
        public Task<bool> VerifyOtpAsync(string mobileNumber, string otpCode, string purpose = "LOGIN") => Task.FromResult(true);
    }
}
