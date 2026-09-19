using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace SuperApp.API.Services;

public class PunjabGovSmsResponse
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("status")]
    public bool Status { get; set; }

    [JsonPropertyName("code")]
    public int Code { get; set; }
}

public class PunjabGovSmsService : ISmsService
{
    private readonly HttpClient _http;
    private readonly ILogger<PunjabGovSmsService> _logger;
    private readonly string _serverKey;
    private readonly string _apiUrl;
    private readonly string _defaultTemplateId;

    public PunjabGovSmsService(
        HttpClient http,
        IConfiguration configuration,
        ILogger<PunjabGovSmsService> logger)
    {
        _http = http;
        _logger = logger;
        _apiUrl = Environment.GetEnvironmentVariable("SMS_API_URL")
            ?? configuration["Sms:ApiUrl"]
            ?? "https://eapi.punjab.gov.in/smapi/sms";
        _serverKey = Environment.GetEnvironmentVariable("SMS_SERVER_KEY")
            ?? configuration["Sms:ServerKey"]
            ?? "r6JKjqXoUXbLpT4nGXTafB6wDjBAKovyQ4t7uOsMnOvtTEPoNCO43KE3edWeXSmb";
        _defaultTemplateId = Environment.GetEnvironmentVariable("SMS_TEMPLATE_ID")
            ?? configuration["Sms:TemplateId"]
            ?? "1407177633307627182";
    }

    public async Task<bool> SendSmsAsync(string mobileNumber, string message, string? templateId = null)
    {
        var cleanNumber = NormalizeMobileNumber(mobileNumber);
        if (string.IsNullOrWhiteSpace(cleanNumber) || cleanNumber.Length < 10)
        {
            _logger.LogWarning("[PunjabGovSms] Invalid mobile number: {MobileNumber}", mobileNumber);
            return false;
        }

        var tid = !string.IsNullOrWhiteSpace(templateId) ? templateId : _defaultTemplateId;

        var payload = new
        {
            mobile_no = cleanNumber,
            message = message,
            template_id = tid,
            is_unicode = true
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _apiUrl);
            request.Headers.Add("Server-Key", _serverKey);
            request.Headers.Add("accept", "*/*");
            request.Content = JsonContent.Create(payload);

            var response = await _http.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[PunjabGovSms] HTTP failure {StatusCode} for {Mobile}: {Body}",
                    response.StatusCode, cleanNumber, responseBody);
                return false;
            }

            try
            {
                var result = System.Text.Json.JsonSerializer.Deserialize<PunjabGovSmsResponse>(responseBody, new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (result != null && (result.Status || result.Code == 200))
                {
                    _logger.LogInformation("[PunjabGovSms] SMS delivered to {Mobile}. Response: {Message}", cleanNumber, result.Message);
                    return true;
                }
            }
            catch
            {
                // If deserialization fails but HTTP was 200, assume sent if body indicates success
                if (responseBody.Contains("success", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("[PunjabGovSms] SMS delivered to {Mobile}. Response body: {Body}", cleanNumber, responseBody);
                    return true;
                }
            }

            _logger.LogWarning("[PunjabGovSms] SMS service reported unsuccessful result for {Mobile}: {Body}", cleanNumber, responseBody);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[PunjabGovSms] Error dispatching SMS to {Mobile}", cleanNumber);
            return false;
        }
    }

    /// <summary>
    /// Normalizes mobile numbers to clean 10-digit format. Strips +91, 0, whitespace, dashes.
    /// </summary>
    public static string NormalizeMobileNumber(string? mobileNumber)
    {
        if (string.IsNullOrWhiteSpace(mobileNumber))
            return string.Empty;

        var digits = new string(mobileNumber.Where(char.IsDigit).ToArray());

        if (digits.Length == 12 && digits.StartsWith("91"))
            return digits.Substring(2);

        if (digits.Length == 11 && digits.StartsWith("0"))
            return digits.Substring(1);

        if (digits.Length > 10)
            return digits.Substring(digits.Length - 10);

        return digits;
    }
}
