using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Development OTP service. Generates a random 6-digit OTP and returns it
/// so the client can display it for testing. Replace with RealOtpService for SMS.
/// </summary>
public class MockOtpService : IOtpService
{
    private readonly AppDbContext _db;
    private const int OtpExpiryMinutes = 5;
    private const int MaxAttempts = 5;

    public MockOtpService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<string> GenerateAndSendOtpAsync(string mobileNumber, string purpose = "LOGIN")
    {
        // Invalidate previous unused OTPs for this number
        var previousOtps = await _db.OtpRequests
            .Where(o => o.MobileNumber == mobileNumber && !o.IsUsed && o.Purpose == purpose)
            .ToListAsync();
        
        foreach (var otp in previousOtps)
        {
            otp.IsUsed = true;
        }

        var otpCode = Random.Shared.Next(100000, 1000000).ToString();

        var otpRequest = new OtpRequest
        {
            MobileNumber = mobileNumber,
            OtpCode = otpCode,
            Purpose = purpose,
            ExpiresAt = DateTime.UtcNow.AddMinutes(OtpExpiryMinutes),
            CreatedAt = DateTime.UtcNow
        };

        _db.OtpRequests.Add(otpRequest);
        await _db.SaveChangesAsync();

        // In development, we return the OTP directly for testing convenience
        // In production, this would send SMS and NOT return the OTP
        return otpCode;
    }

    public async Task<bool> VerifyOtpAsync(string mobileNumber, string otpCode, string purpose = "LOGIN")
    {
        var otpRequest = await _db.OtpRequests
            .Where(o => o.MobileNumber == mobileNumber
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

        if (otpRequest.OtpCode != otpCode)
        {
            await _db.SaveChangesAsync();
            return false;
        }

        otpRequest.IsUsed = true;
        await _db.SaveChangesAsync();
        return true;
    }
}
