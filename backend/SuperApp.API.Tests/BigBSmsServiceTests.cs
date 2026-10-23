using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SuperApp.API.Data;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class BigBSmsServiceTests
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
        var result = BigBSmsService.NormalizeMobileNumber(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task BigBOtpService_GeneratesDynamicOtp_AndDispatchesTemplateMessage()
    {
        var previousTestMode = Environment.GetEnvironmentVariable("OTP_TEST_MODE");
        var previousEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var previousTestOtp = Environment.GetEnvironmentVariable("TEST_OTP");
        try
        {
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", null);
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
            Environment.SetEnvironmentVariable("TEST_OTP", null);

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new AppDbContext(options);
            var mockSms = new MockSmsClient();
            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var otpService = new BigBOtpService(db, mockSms, config, NullLogger<BigBOtpService>.Instance);
            var testPhone = "+916375002348";

            var otpCode = await otpService.GenerateAndSendOtpAsync(testPhone, "LOGIN");

            Assert.Equal(6, otpCode.Length);
            Assert.True(int.TryParse(otpCode, out _));
            Assert.Equal("6375002348", mockSms.LastMobile);
            Assert.Equal("1407177633307627182", mockSms.LastTemplateId);
            Assert.Equal(
                $"Your login OTP is {otpCode}. Valid for 3 mins. Do not share this code with anyone. BIGB Secure",
                mockSms.LastMessage);

            var dbRecord = await db.OtpRequests.FirstOrDefaultAsync(o => o.MobileNumber == "6375002348");
            Assert.NotNull(dbRecord);
            Assert.Equal(otpCode, dbRecord.OtpCode);
            Assert.False(dbRecord.IsUsed);
            Assert.True(dbRecord.ExpiresAt > DateTime.UtcNow.AddMinutes(2.5));

            var wrongCheck = await otpService.VerifyOtpAsync(testPhone, "000000", "LOGIN");
            Assert.False(wrongCheck);

            var correctCheck = await otpService.VerifyOtpAsync(testPhone, otpCode, "LOGIN");
            Assert.True(correctCheck);

            var reuseCheck = await otpService.VerifyOtpAsync(testPhone, otpCode, "LOGIN");
            Assert.False(reuseCheck);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", previousTestMode);
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousEnv);
            Environment.SetEnvironmentVariable("TEST_OTP", previousTestOtp);
        }
    }

    [Fact]
    public async Task BigBOtpService_TestMode_StoresTestOtp_SkipsSms_AndAcceptsVerify()
    {
        var previousTestMode = Environment.GetEnvironmentVariable("OTP_TEST_MODE");
        var previousEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var previousTestOtp = Environment.GetEnvironmentVariable("TEST_OTP");
        try
        {
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", "true");
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
            Environment.SetEnvironmentVariable("TEST_OTP", "123456");

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new AppDbContext(options);
            var mockSms = new MockSmsClient();
            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var otpService = new BigBOtpService(db, mockSms, config, NullLogger<BigBOtpService>.Instance);

            var otpCode = await otpService.GenerateAndSendOtpAsync("9810012345", "LOGIN");

            Assert.Equal("123456", otpCode);
            Assert.Null(mockSms.LastMobile); // SMS must not fire in overnight/UAT test mode

            var ok = await otpService.VerifyOtpAsync("9810012345", "123456", "LOGIN");
            Assert.True(ok);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", previousTestMode);
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousEnv);
            Environment.SetEnvironmentVariable("TEST_OTP", previousTestOtp);
        }
    }

    [Fact]
    public async Task BigBOtpService_EmptyTestOtpEnv_FallsBackToDefault123456_InTestMode()
    {
        var previousTestMode = Environment.GetEnvironmentVariable("OTP_TEST_MODE");
        var previousEnv = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var previousTestOtp = Environment.GetEnvironmentVariable("TEST_OTP");
        try
        {
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", "true");
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");
            Environment.SetEnvironmentVariable("TEST_OTP", ""); // empty .env value must not win

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var db = new AppDbContext(options);
            var mockSms = new MockSmsClient();
            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var otpService = new BigBOtpService(db, mockSms, config, NullLogger<BigBOtpService>.Instance);

            var otpCode = await otpService.GenerateAndSendOtpAsync("9810099999", "LOGIN");
            Assert.Equal("123456", otpCode);
            Assert.Null(mockSms.LastMobile);
        }
        finally
        {
            Environment.SetEnvironmentVariable("OTP_TEST_MODE", previousTestMode);
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", previousEnv);
            Environment.SetEnvironmentVariable("TEST_OTP", previousTestOtp);
        }
    }

    [Fact]
    public async Task TwoFactorSmsService_ReturnsFalse_WhenApiKeyMissing()
    {
        var inMemory = new Dictionary<string, string?>
        {
            { "TwoFactor:ApiKey", "" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemory).Build();
        var client = new HttpClient();
        var service = new TwoFactorSmsService(client, config, NullLogger<TwoFactorSmsService>.Instance);

        var result = await service.SendSmsAsync("9876543210", "Your OTP is 1234");
        Assert.False(result);
    }
}
