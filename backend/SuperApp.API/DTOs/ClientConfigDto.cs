namespace SuperApp.API.DTOs;

public class ClientConfigDto
{
    public string MapProvider { get; set; } = "Mapbox";
    public string MapboxAccessToken { get; set; } = string.Empty;
    public string PaymentProvider { get; set; } = "Razorpay";
    public string? PaymentKeyId { get; set; }
    public string Environment { get; set; } = "prod";
    public bool ShowTestOtp { get; set; } = false;
    public string ApiBaseUrl { get; set; } = string.Empty;
    public string SignalRHubUrl { get; set; } = string.Empty;
}

/// <summary>Public Help &amp; Support content configured by admin via AppSettings.</summary>
public class SupportConfigDto
{
    public string Phone { get; set; } = string.Empty;
    public string WhatsApp { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Hours { get; set; } = string.Empty;
    public string Faq { get; set; } = string.Empty;
    /// <summary>Default home marquee visibility window when a broadcast omits DisplayHours.</summary>
    public int BroadcastDefaultDisplayHours { get; set; } = 24;
}

