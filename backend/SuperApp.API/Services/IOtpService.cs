namespace SuperApp.API.Services;

public interface IOtpService
{
    Task<string> GenerateAndSendOtpAsync(string mobileNumber, string purpose = "LOGIN");
    Task<bool> VerifyOtpAsync(string mobileNumber, string otpCode, string purpose = "LOGIN");
}
