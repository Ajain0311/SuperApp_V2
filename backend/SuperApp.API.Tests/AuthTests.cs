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

    [Fact]
    public async Task MockOtpService_RejectsMasterOtp_InProduction()
    {
        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<SuperApp.API.Data.AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        using var db = new SuperApp.API.Data.AppDbContext(options);
        var otpService = new MockOtpService(db);
        var phone = "9876543210";

        var origEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var origTest = Environment.GetEnvironmentVariable("OTP_TEST_MODE");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Production");
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", "true");

            await otpService.GenerateAndSendOtpAsync(phone, "LOGIN");
            var isValid = await otpService.VerifyOtpAsync(phone, "123456", "LOGIN");

            Assert.False(isValid, "Master OTP 123456 should be rejected in Production environment");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", origEnv);
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", origTest);
        }
    }
}
