using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SuperApp.API.Services;

public class Fast2SmsResponse
{
    [JsonPropertyName("return")]
    public bool Return { get; set; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; set; }

    [JsonPropertyName("message")]
    public JsonElement Message { get; set; }

    [JsonPropertyName("status_code")]
    public int StatusCode { get; set; }
}

public class Fast2SmsService : ISmsService
{
    private readonly HttpClient _http;
    private readonly ILogger<Fast2SmsService> _logger;
    private readonly string _apiKey;
    private readonly string _apiUrl;

    public Fast2SmsService(
        HttpClient http,
        IConfiguration configuration,
        ILogger<Fast2SmsService> logger)
    {
        _http = http;
        _logger = logger;
        _apiUrl = Environment.GetEnvironmentVariable("FAST2SMS_API_URL")
            ?? configuration["Fast2Sms:ApiUrl"]
            ?? "https://www.fast2sms.com/dev/bulkV2";
        _apiKey = Environment.GetEnvironmentVariable("FAST2SMS_API_KEY")
            ?? configuration["Fast2Sms:ApiKey"]
            ?? string.Empty;
    }

    public async Task<bool> SendSmsAsync(string mobileNumber, string message, string? templateId = null)
    {
        var cleanNumber = NormalizeMobileNumber(mobileNumber);
        if (string.IsNullOrWhiteSpace(cleanNumber) || cleanNumber.Length < 10)
        {
            _logger.LogWarning("[Fast2Sms] Invalid mobile number: {MobileNumber}", mobileNumber);
            return false;
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            _logger.LogError("[Fast2Sms] API key is not configured. Cannot send SMS.");
            return false;
        }

        // Fast2SMS bulkV2 route=q (Quick SMS) sends custom text messages
        var payload = new
        {
            route = "q",
            message = message,
            language = "english",
            flash = 0,
            numbers = cleanNumber
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _apiUrl);
            request.Headers.Add("authorization", _apiKey);
            request.Headers.Add("accept", "application/json");
            request.Content = JsonContent.Create(payload);

            var response = await _http.SendAsync(request);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Fast2Sms] HTTP failure {StatusCode} for {Mobile}: {Body}",
                    response.StatusCode, cleanNumber, responseBody);
                return false;
            }

            try
            {
                var result = JsonSerializer.Deserialize<Fast2SmsResponse>(responseBody, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (result != null && result.Return)
                {
                    _logger.LogInformation("[Fast2Sms] SMS delivered to {Mobile}. RequestId: {RequestId}", cleanNumber, result.RequestId);
                    return true;
                }
            }
            catch
            {
                if (responseBody.Contains("\"return\":true", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("[Fast2Sms] SMS delivered to {Mobile}. Response body: {Body}", cleanNumber, responseBody);
                    return true;
                }
            }

            _logger.LogWarning("[Fast2Sms] Fast2SMS reported unsuccessful result for {Mobile}: {Body}", cleanNumber, responseBody);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Fast2Sms] Error dispatching SMS to {Mobile}", cleanNumber);
            return false;
        }
    }

    /// <summary>
    /// Normalizes mobile numbers to clean 10-digit format.
    /// </summary>
    public static string NormalizeMobileNumber(string? mobileNumber)
    {
        return PunjabGovSmsService.NormalizeMobileNumber(mobileNumber);
    }
}
