namespace SuperApp.API.DTOs;

public class ClientConfigDto
{
    public string MapProvider { get; set; } = "Mapbox";
    public string MapboxAccessToken { get; set; } = string.Empty;
    public string PaymentProvider { get; set; } = "Easebuzz";
    public string? PaymentKeyId { get; set; }
    public string Environment { get; set; } = "prod";
    public bool ShowTestOtp { get; set; } = false;
    public string ApiBaseUrl { get; set; } = string.Empty;
    public string SignalRHubUrl { get; set; } = string.Empty;
}
