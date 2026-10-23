using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>Admin-configurable Help &amp; Support keys stored in AppSettings.</summary>
public static class SupportSettings
{
    public const string PhoneKey = "support_phone";
    public const string WhatsAppKey = "support_whatsapp";
    public const string EmailKey = "support_email";
    public const string HoursKey = "support_hours";
    public const string FaqKey = "support_faq";
    public const string BroadcastDefaultHoursKey = "broadcast_default_display_hours";

    public static readonly (string Key, string Value, string Description)[] Defaults =
    {
        (PhoneKey, "18001234567", "Help & Support phone (toll-free or mobile, digits)"),
        (WhatsAppKey, "919876543210", "Help & Support WhatsApp number with country code (no +)"),
        (EmailKey, "support@makemytree.com", "Help & Support email address"),
        (HoursKey, "24x7 Customer Support", "Support hours shown on Help screen"),
        (FaqKey,
            "Q: How do I track my order?\nA: Open Activity or order confirmation for live tracking.\n\nQ: How do I cancel?\nA: Cancel from order details before the restaurant accepts.\n\nQ: Payment failed but money deducted?\nA: Contact support with your order ID; refunds usually settle in 3-5 days.",
            "FAQ text shown on Help & Support (Q:/A: blocks, max ~1000 chars)"),
        (BroadcastDefaultHoursKey, "24", "Default home marquee duration in hours when broadcast omits DisplayHours (1–168)"),
    };

    public static async Task EnsureDefaultsAsync(AppDbContext db)
    {
        var existing = await db.AppSettings
            .Where(s => Defaults.Select(d => d.Key).Contains(s.SettingKey))
            .Select(s => s.SettingKey)
            .ToListAsync();

        var missing = Defaults.Where(d => !existing.Contains(d.Key)).ToList();
        if (missing.Count == 0) return;

        foreach (var d in missing)
        {
            db.AppSettings.Add(new AppSetting
            {
                SettingKey = d.Key,
                SettingValue = d.Value,
                Description = d.Description,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
    }

    public static async Task<SupportConfigDto> LoadAsync(AppDbContext db)
    {
        await EnsureDefaultsAsync(db);

        var keys = Defaults.Select(d => d.Key).ToArray();
        var rows = await db.AppSettings
            .AsNoTracking()
            .Where(s => keys.Contains(s.SettingKey))
            .ToListAsync();

        string Val(string key) =>
            rows.FirstOrDefault(r => r.SettingKey == key)?.SettingValue?.Trim()
            ?? Defaults.First(d => d.Key == key).Value;

        var hoursRaw = Val(BroadcastDefaultHoursKey);
        var defaultHours = 24;
        if (int.TryParse(hoursRaw, out var parsedHours))
            defaultHours = Math.Clamp(parsedHours, 1, 168);

        return new SupportConfigDto
        {
            Phone = Val(PhoneKey),
            WhatsApp = Val(WhatsAppKey),
            Email = Val(EmailKey),
            Hours = Val(HoursKey),
            Faq = Val(FaqKey),
            BroadcastDefaultDisplayHours = defaultHours,
        };
    }

    public static async Task<int> ResolveBroadcastDisplayHoursAsync(AppDbContext db, int? requestedHours)
    {
        if (requestedHours.HasValue)
            return Math.Clamp(requestedHours.Value, 1, 168);

        await EnsureDefaultsAsync(db);
        var row = await db.AppSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.SettingKey == BroadcastDefaultHoursKey);
        if (row != null && int.TryParse(row.SettingValue, out var h))
            return Math.Clamp(h, 1, 168);
        return 24;
    }

    /// <summary>Compact expiry token stored in Notification.ReferenceId (max 50).</summary>
    public static string FormatBroadcastExpiry(DateTime expiresUtc) =>
        "exp:" + expiresUtc.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
}
