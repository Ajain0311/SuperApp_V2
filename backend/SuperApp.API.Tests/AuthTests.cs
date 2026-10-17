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
    public async Task AdminLogin_Rejects_InvalidOtp()
    {
        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        using var db = new SuperApp.API.Data.AppDbContext(options);

        var adminRole = new Role { Id = 1, Name = RoleNames.Admin };
        db.Roles.Add(adminRole);

        var adminUser = new User
        {
            Id = 11,
            MobileNumber = "9999999999",
            FullName = "Admin User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("AdminPass@2026"),
            IsActive = true
        };
        db.Users.Add(adminUser);
        db.UserRoles.Add(new UserRole { UserId = 11, RoleId = 1 });
        await db.SaveChangesAsync();

        var otpService = new MockOtpService(db);
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var tokenService = new TokenService(config);
        var controller = new SuperApp.API.Controllers.AuthController(db, otpService, tokenService);

        // Generate real OTP
        var realOtp = await otpService.GenerateAndSendOtpAsync("9999999999");

        // Attempt login with wrong OTP
        var result = await controller.AdminLogin(new SuperApp.API.DTOs.AdminLoginRequest
        {
            MobileNumber = "+919999999999",
            Password = "AdminPass@2026",
            OtpCode = "000000" // Wrong OTP
        });

        var badReq = Assert.IsType<Microsoft.AspNetCore.Mvc.BadRequestObjectResult>(result.Result);
        var res = Assert.IsType<SuperApp.API.DTOs.AuthResponse>(badReq.Value);
        Assert.False(res.Success);
        Assert.Equal("Invalid or expired OTP", res.Message);

        // Verify entry in OtpRequests has clean 10-digit mobile number
        var otpEntry = await db.OtpRequests.FirstOrDefaultAsync(o => o.MobileNumber == "9999999999");
        Assert.NotNull(otpEntry);
        Assert.Equal(realOtp, otpEntry.OtpCode);

        // Now attempt with correct OTP and normalized mobile number with country code prefix
        var validResult = await controller.AdminLogin(new SuperApp.API.DTOs.AdminLoginRequest
        {
            MobileNumber = "+919999999999",
            Password = "AdminPass@2026",
            OtpCode = realOtp
        });

        var okReq = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(validResult.Result);
        var okRes = Assert.IsType<SuperApp.API.DTOs.AuthResponse>(okReq.Value);
        Assert.True(okRes.Success);
        Assert.NotNull(okRes.Token);
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

    [Fact]
    public void ProductionSecurityValidator_RejectsWeakOrDefaultJwtInProduction()
    {
        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidateJwtSecret(null, true));

        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidateJwtSecret("", true));

        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidateJwtSecret("short_secret_under_32_chars", true));

        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidateJwtSecret(SuperApp.API.Services.ProductionSecurityValidator.DefaultDevJwtSecret, true));

        // Allowed in non-production
        SuperApp.API.Services.ProductionSecurityValidator.ValidateJwtSecret(SuperApp.API.Services.ProductionSecurityValidator.DefaultDevJwtSecret, false);

        // Allowed in production with strong unique 32+ char key
        SuperApp.API.Services.ProductionSecurityValidator.ValidateJwtSecret("a_secure_production_secret_key_with_proper_length_123456", true);
    }

    [Fact]
    public void ProductionSecurityValidator_RejectsMockPaymentOrMissingCredentialsInProduction()
    {
        // Rejects Mock provider
        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidatePaymentProvider("Mock", null, null, true));

        // Rejects Easebuzz with missing key or salt
        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidatePaymentProvider("Easebuzz", "key123", "", true));

        // Allowed in non-production
        SuperApp.API.Services.ProductionSecurityValidator.ValidatePaymentProvider("Mock", null, null, false);

        // Allowed in production with Easebuzz and credentials
        SuperApp.API.Services.ProductionSecurityValidator.ValidatePaymentProvider("Easebuzz", "live_key", "live_salt", true);
    }

    [Fact]
    public void ProductionSecurityValidator_RejectsMockOtpOrTestModeInProduction()
    {
        // Rejects Mock OTP
        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidateOtpProvider("Mock", false, true));

        // Rejects test mode OTP
        Assert.Throws<InvalidOperationException>(() =>
            SuperApp.API.Services.ProductionSecurityValidator.ValidateOtpProvider("PunjabGov", true, true));

        // Allowed in non-production
        SuperApp.API.Services.ProductionSecurityValidator.ValidateOtpProvider("Mock", true, false);

        // Allowed in production with live provider and test mode off
        SuperApp.API.Services.ProductionSecurityValidator.ValidateOtpProvider("PunjabGov", false, true);
    }

    private class MockOtpServiceForProdTest : IOtpService
    {
        public Task<string> GenerateAndSendOtpAsync(string mobileNumber, string purpose = "LOGIN") => Task.FromResult("999888");
        public Task<bool> VerifyOtpAsync(string mobileNumber, string otpCode, string purpose = "LOGIN") => Task.FromResult(true);
    }
}
