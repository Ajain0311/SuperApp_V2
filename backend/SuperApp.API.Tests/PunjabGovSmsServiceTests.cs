using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SuperApp.API.Data;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class PunjabGovSmsServiceTests
{
    private class MockSmsClient : ISmsService
    {
        public string? LastMobile { get; private set; }
        public string? LastMessage { get; private set; }
        public string? LastTemplateId { get; private set; }
        public bool ReturnResult { get; set; } = true;

        public Task<bool> SendSmsAsync(string mobileNumber, string message, string? templateId = null)
        {
            LastMobile = mobileNumber;
            LastMessage = message;
            LastTemplateId = templateId;
            return Task.FromResult(ReturnResult);
        }
    }

    [Theory]
    [InlineData("6375002348", "6375002348")]
    [InlineData("+916375002348", "6375002348")]
    [InlineData("916375002348", "6375002348")]
    [InlineData("06375002348", "6375002348")]
    [InlineData("+91 63750 02348", "6375002348")]
    [InlineData("+91-63750-02348", "6375002348")]
    public void NormalizeMobileNumber_ReturnsTenDigitCleanString(string input, string expected)
    {
        var result = PunjabGovSmsService.NormalizeMobileNumber(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task PunjabGovOtpService_GeneratesDynamicOtp_AndDispatchesTemplateMessage()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        using var db = new AppDbContext(options);
        var mockSms = new MockSmsClient();
        var otpService = new PunjabGovOtpService(db, mockSms, NullLogger<PunjabGovOtpService>.Instance);
        var testPhone = "+916375002348";

        // Act
        var otpCode = await otpService.GenerateAndSendOtpAsync(testPhone, "LOGIN");

        // Assert
        Assert.Equal(6, otpCode.Length);
        Assert.True(int.TryParse(otpCode, out _));

        // Verify SMS client received the dynamically replaced template message
        Assert.Equal("6375002348", mockSms.LastMobile);
        Assert.Equal("1407177633307627182", mockSms.LastTemplateId);
        Assert.Equal(
            $"Your Sanwaliya Ji OTP is {otpCode}. Valid for 3 mins. Do not share this code with anyone. Govt. of Punjab",
            mockSms.LastMessage);

        // Verify Database record
        var dbRecord = await db.OtpRequests.FirstOrDefaultAsync(o => o.MobileNumber == "6375002348");
        Assert.NotNull(dbRecord);
        Assert.Equal(otpCode, dbRecord.OtpCode);
        Assert.False(dbRecord.IsUsed);
        Assert.True(dbRecord.ExpiresAt > DateTime.UtcNow.AddMinutes(2.5));

        // Verify OTP verification flow
        var wrongCheck = await otpService.VerifyOtpAsync(testPhone, "000000", "LOGIN");
        Assert.False(wrongCheck);

        var correctCheck = await otpService.VerifyOtpAsync(testPhone, otpCode, "LOGIN");
        Assert.True(correctCheck);

        // Verify OTP cannot be reused
        var reuseCheck = await otpService.VerifyOtpAsync(testPhone, otpCode, "LOGIN");
        Assert.False(reuseCheck);
    }
}
