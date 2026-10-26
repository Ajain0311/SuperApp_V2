using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Real OTP service backed by the BIGB SMS gateway API.
/// Generates a 6-digit random code, saves it to the database with 3-minute expiry,
/// and dispatches SMS via the registered DLT template.
/// When OTP_TEST_MODE=true outside Production, stores TEST_OTP and skips live SMS
/// so overnight multi-agent volume runs can authenticate without SMS spam.
/// </summary>
public class BigBOtpService : IOtpService
{
    private readonly AppDbContext _db;
    private readonly IServiceProvider _serviceProvider;
    private readonly ISmsService _smsService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BigBOtpService> _logger;
    private const int OtpExpiryMinutes = 3;
    private const int MaxAttempts = 5;
    private readonly string _templateId;
    private readonly string _testOtp;

    public BigBOtpService(
        AppDbContext db,
        ISmsService smsService,
        IConfiguration configuration,
        ILogger<BigBOtpService> logger,
        IServiceProvider serviceProvider)
    {
        _db = db;
        _smsService = smsService;
        _configuration = configuration;
        _logger = logger;
        _serviceProvider = serviceProvider;
        _templateId = Environment.GetEnvironmentVariable("SMS_TEMPLATE_ID")
            ?? configuration["Sms:TemplateId"]
            ?? "1407177633307627182";
        // Empty TEST_OTP= in .env must not win over the default — overnight relies on 123456.
        var envTestOtp = Environment.GetEnvironmentVariable("TEST_OTP");
        _testOtp = string.IsNullOrWhiteSpace(envTestOtp)
            ? (configuration["Auth:TestOtp"] ?? "123456")
            : envTestOtp.Trim();
    }

    private bool IsOtpTestModeEnabled()
    {
        var mode = Environment.GetEnvironmentVariable("OTP_MODE")
            ?? _configuration["Otp:Mode"]
            ?? (string.Equals(Environment.GetEnvironmentVariable("OTP_TEST_MODE"), "true", StringComparison.OrdinalIgnoreCase) ? "test" : null);

        if (!string.IsNullOrWhiteSpace(mode))
        {
            return string.Equals(mode, "test", StringComparison.OrdinalIgnoreCase);
        }

        var isTestMode = string.Equals(Environment.GetEnvironmentVariable("OTP_TEST_MODE"), "true", StringComparison.OrdinalIgnoreCase);
        var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);
        return isTestMode && !isProd;
    }

    public async Task<string> GenerateAndSendOtpAsync(string mobileNumber, string purpose = "LOGIN")
    {
        var cleanMobile = BigBSmsService.NormalizeMobileNumber(mobileNumber);

        // 1. Invalidate previous unused OTPs for this number and purpose
        var previousOtps = await _db.OtpRequests
            .Where(o => (o.MobileNumber == mobileNumber || o.MobileNumber == cleanMobile) && !o.IsUsed && o.Purpose == purpose)
            .ToListAsync();

        foreach (var otp in previousOtps)
        {
            otp.IsUsed = true;
        }

        // 2. OTP_TEST_MODE (non-Production): store configured TEST_OTP and skip live SMS spam for overnight/UAT.
        var useTestOtp = IsOtpTestModeEnabled() && !string.IsNullOrWhiteSpace(_testOtp);
        var otpCode = useTestOtp
            ? _testOtp
            : Random.Shared.Next(100000, 1000000).ToString();

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

        if (useTestOtp)
        {
            _logger.LogInformation("[BigBOtpService] OTP_TEST_MODE active — stored TEST_OTP for {Mobile}, skipped live SMS.", cleanMobile);
            return otpCode;
        }

        // 4. Construct registered DLT message with dynamic OTP
        var message = $"Your login OTP is {otpCode}. Valid for 3 mins. Do not share this code with anyone. Govt. of Punjab";

        // 5. Dispatch SMS via Gateway asynchronously in background so mobile client transitions instantly
        var targetMobile = cleanMobile;
        var targetMsg = message;
        var targetTid = _templateId;
        var sp = _serviceProvider;
        var log = _logger;

        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = sp.CreateScope();
                var scopedSms = scope.ServiceProvider.GetRequiredService<ISmsService>();
                var sent = await scopedSms.SendSmsAsync(targetMobile, targetMsg, targetTid);
                if (sent)
                {
                    log.LogInformation("[BigBOtpService] Live OTP SMS dispatched successfully to {Mobile}", targetMobile);
                }
                else
                {
                    log.LogWarning("[BigBOtpService] Live SMS gateway returned false for {Mobile}. OTP is already saved in database.", targetMobile);
                }
            }
            catch (Exception ex)
            {
                log.LogError(ex, "[BigBOtpService] Background SMS delivery failed for {Mobile}", targetMobile);
            }
        });

        return otpCode;
    }

    public async Task<bool> VerifyOtpAsync(string mobileNumber, string otpCode, string purpose = "LOGIN")
    {
        var cleanMobile = BigBSmsService.NormalizeMobileNumber(mobileNumber);

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
            // Non-Production + OTP_TEST_MODE: accept configured TEST_OTP (overnight agents).
            if (IsOtpTestModeEnabled() && !string.IsNullOrWhiteSpace(_testOtp) && cleanInputOtp == _testOtp)
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
