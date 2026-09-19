using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Real OTP service backed by the Punjab Government SMS gateway API.
/// Generates a 6-digit random code, saves it to the database with 3-minute expiry,
/// and dispatches SMS via the registered DLT template.
/// </summary>
public class PunjabGovOtpService : IOtpService
{
    private readonly AppDbContext _db;
    private readonly ISmsService _smsService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PunjabGovOtpService> _logger;
    private const int OtpExpiryMinutes = 3;
    private const int MaxAttempts = 5;
    private readonly string _templateId;
    private readonly string _testOtp;

    public PunjabGovOtpService(
        AppDbContext db,
        ISmsService smsService,
        IConfiguration configuration,
        ILogger<PunjabGovOtpService> logger)
    {
        _db = db;
        _smsService = smsService;
        _configuration = configuration;
        _logger = logger;
        _templateId = Environment.GetEnvironmentVariable("SMS_TEMPLATE_ID")
            ?? configuration["Sms:TemplateId"]
            ?? "1407177633307627182";
        _testOtp = Environment.GetEnvironmentVariable("TEST_OTP")
            ?? configuration["Auth:TestOtp"]
            ?? "123456";
    }

    public async Task<string> GenerateAndSendOtpAsync(string mobileNumber, string purpose = "LOGIN")
    {
        var cleanMobile = PunjabGovSmsService.NormalizeMobileNumber(mobileNumber);

        // 1. Invalidate previous unused OTPs for this number and purpose
        var previousOtps = await _db.OtpRequests
            .Where(o => (o.MobileNumber == mobileNumber || o.MobileNumber == cleanMobile) && !o.IsUsed && o.Purpose == purpose)
            .ToListAsync();

        foreach (var otp in previousOtps)
        {
            otp.IsUsed = true;
        }

        // 2. Generate random 6-digit numeric OTP
        var otpCode = Random.Shared.Next(100000, 1000000).ToString();

        // 3. Save to database with 3-minute validity
        var otpRequest = new OtpRequest
        {
            MobileNumber = cleanMobile,
            OtpCode = otpCode,
            Purpose = purpose,
            ExpiresAt = DateTime.UtcNow.AddMinutes(OtpExpiryMinutes),
            CreatedAt = DateTime.UtcNow,
            AttemptCount = 0,
            IsUsed = false
        };

        _db.OtpRequests.Add(otpRequest);
        await _db.SaveChangesAsync();

        // 4. Construct registered DLT message with dynamic OTP
        var message = $"Your Sanwaliya Ji OTP is {otpCode}. Valid for 3 mins. Do not share this code with anyone. Govt. of Punjab";

        // 5. Dispatch SMS via Punjab Gov Gateway
        var sent = await _smsService.SendSmsAsync(cleanMobile, message, _templateId);
        if (sent)
        {
            _logger.LogInformation("[PunjabGovOtpService] Live OTP SMS sent successfully to {Mobile}", cleanMobile);
        }
        else
        {
            _logger.LogWarning("[PunjabGovOtpService] Live SMS send returned false for {Mobile}. OTP is saved in database.", cleanMobile);
        }

        return otpCode;
    }

    public async Task<bool> VerifyOtpAsync(string mobileNumber, string otpCode, string purpose = "LOGIN")
    {
        var cleanMobile = PunjabGovSmsService.NormalizeMobileNumber(mobileNumber);

        var otpRequest = await _db.OtpRequests
            .Where(o => (o.MobileNumber == mobileNumber || o.MobileNumber == cleanMobile)
                     && !o.IsUsed
                     && o.Purpose == purpose
                     && o.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (otpRequest == null)
            return false;

        otpRequest.AttemptCount++;

        if (otpRequest.AttemptCount > MaxAttempts)
        {
            otpRequest.IsUsed = true;
            await _db.SaveChangesAsync();
            return false;
        }

        var cleanInputOtp = otpCode.Trim();
        if (otpRequest.OtpCode != cleanInputOtp)
        {
            // In non-production environments, permit configured test OTP (e.g. 123456)
            var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);
            if (!isProd && (cleanInputOtp == _testOtp || cleanInputOtp == "123456"))
            {
                otpRequest.IsUsed = true;
                await _db.SaveChangesAsync();
                return true;
            }

            await _db.SaveChangesAsync();
            return false;
        }

        otpRequest.IsUsed = true;
        await _db.SaveChangesAsync();
        return true;
    }
}
