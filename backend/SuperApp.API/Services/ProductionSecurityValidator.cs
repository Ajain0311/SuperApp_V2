namespace SuperApp.API.Services;

/// <summary>
/// Validates security and external provider configurations for production readiness.
/// Ensures that unsafe defaults, mock providers, or unconfigured live providers cannot boot in Production.
/// </summary>
public static class ProductionSecurityValidator
{
    public const string DefaultDevJwtSecret = "SuperApp_Development_Secret_Key_2026_Must_Be_At_Least_32_Characters";

    public static void ValidateJwtSecret(string? secret, bool isProduction)
    {
        if (!isProduction) return;

        if (string.IsNullOrWhiteSpace(secret) ||
            string.Equals(secret, DefaultDevJwtSecret, StringComparison.OrdinalIgnoreCase) ||
            secret.Length < 32)
        {
            throw new InvalidOperationException("CRITICAL: Insecure or default JWT secret cannot be used in a Production environment. Configure a strong JWT_SECRET with at least 32 characters.");
        }
    }

    public static void ValidatePaymentProvider(string? provider, string? key, string? salt, bool isProduction)
    {
        if (!isProduction) return;

        var isMock = string.IsNullOrWhiteSpace(provider) || string.Equals(provider, "Mock", StringComparison.OrdinalIgnoreCase);
        var hasValidRazorpay = string.Equals(provider, "Razorpay", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(key)
            && !string.IsNullOrWhiteSpace(salt);

        if (isMock || !hasValidRazorpay)
        {
            throw new InvalidOperationException("CRITICAL: MockPaymentService or unconfigured payment gateway cannot be used in a Production environment. Configure Razorpay with valid credentials.");
        }
    }

    public static void ValidateOtpProvider(string? provider, bool isTestMode, bool isProduction)
    {
        if (!isProduction) return;

        if (string.Equals(provider, "Mock", StringComparison.OrdinalIgnoreCase) || isTestMode)
        {
            throw new InvalidOperationException("CRITICAL: MockOtpService or OTP_TEST_MODE cannot be enabled in a Production environment. Configure a live SMS provider.");
        }
    }

    public static void ValidateMapProvider(string? provider, string? mapboxToken, bool isProduction)
    {
        if (!isProduction) return;

        if (string.Equals(provider, "Mapbox", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(mapboxToken))
        {
            throw new InvalidOperationException("CRITICAL: Mapbox map provider is configured for Production but MAPBOX_ACCESS_TOKEN is missing.");
        }
    }

    public static void ValidateNotificationProvider(string? provider, bool isProduction)
    {
        if (!isProduction) return;

        if (string.Equals(provider, "Mock", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("CRITICAL: MockNotificationService cannot be used in a Production environment. Configure NOTIFICATION_PROVIDER=Push, Expo, or Fcm.");
        }
    }
}

