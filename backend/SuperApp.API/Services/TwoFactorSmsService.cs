using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace SuperApp.API.Services;

public class TwoFactorSmsResponse
{
    [JsonPropertyName("Status")]
    public string? Status { get; set; }

    [JsonPropertyName("Details")]
    public string? Details { get; set; }
}

/// <summary>
/// SMS service backed by 2Factor.in API.
/// Supports sending custom OTP codes via https://2factor.in/API/V1/{apiKey}/SMS/{phone}/{otp}
/// and transactional SMS.
/// </summary>
public class TwoFactorSmsService : ISmsService
{
    private readonly HttpClient _http;
    private readonly ILogger<TwoFactorSmsService> _logger;
    private readonly string _apiKey;
    private readonly string _baseUrl;

    public TwoFactorSmsService(
        HttpClient http,
        IConfiguration configuration,
        ILogger<TwoFactorSmsService> logger)
    {
        _http = http;
        _logger = logger;
        _apiKey = Environment.GetEnvironmentVariable("TWOFACTOR_API_KEY")
            ?? configuration["TwoFactor:ApiKey"]
            ?? "4f56d46d-ca4e-11f1-af74-0200cd936042";
        _baseUrl = Environment.GetEnvironmentVariable("TWOFACTOR_BASE_URL")
            ?? configuration["TwoFactor:BaseUrl"]
            ?? "https://2factor.in/API/V1";
    }

    public async Task<bool> SendSmsAsync(string mobileNumber, string message, string? templateId = null)
    {
        var cleanMobile = BigBSmsService.NormalizeMobileNumber(mobileNumber);
        if (string.IsNullOrWhiteSpace(cleanMobile) || cleanMobile.Length < 10)
        {
            _logger.LogWarning("[TwoFactorSms] Invalid mobile number: {MobileNumber}", mobileNumber);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogError("[TwoFactorSms] 2Factor API key is missing");
            return false;
        }

        // Extract 4-8 digit OTP from message if present
        var otpMatch = Regex.Match(message, @"\b\d{4,8}\b");
        var otpCode = otpMatch.Success ? otpMatch.Value : "123456";

        // 2Factor custom OTP endpoint:
        // GET https://2factor.in/API/V1/{apiKey}/SMS/+91{mobile}/{otp}
        var formattedPhone = cleanMobile.StartsWith("+") ? cleanMobile : $"+91{cleanMobile}";
        var requestUrl = $"{_baseUrl.TrimEnd('/')}/{_apiKey}/SMS/{formattedPhone}/{otpCode}";
        if (!string.IsNullOrWhiteSpace(templateId))
        {
            requestUrl += $"/{templateId}";
        }

        try
        {
            using var response = await _http.GetAsync(requestUrl);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[TwoFactorSms] HTTP failure {StatusCode} for {Mobile}: {Body}",
                    response.StatusCode, cleanMobile, responseBody);
                return false;
            }

            var result = JsonSerializer.Deserialize<TwoFactorSmsResponse>(responseBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (result != null && string.Equals(result.Status, "Success", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("[TwoFactorSms] OTP SMS successfully dispatched to {Mobile}. Session: {SessionId}",
                    cleanMobile, result.Details);
                return true;
            }

            _logger.LogWarning("[TwoFactorSms] Provider returned non-success for {Mobile}: {Body}", cleanMobile, responseBody);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TwoFactorSms] Exception dispatching SMS to {Mobile}", cleanMobile);
            return false;
        }
    }
}
