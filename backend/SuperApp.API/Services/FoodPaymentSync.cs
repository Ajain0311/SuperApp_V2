using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Applies a gateway result onto the food order. PAID is written only when the
/// payment row itself is already PAID after server-side verification.
/// </summary>
public static class FoodPaymentSync
{
    public static async Task ApplyAsync(AppDbContext db, string? transactionId, bool verified)
    {
        if (string.IsNullOrWhiteSpace(transactionId))
            return;

        var payment = await db.Payments.FirstOrDefaultAsync(p => p.TransactionId == transactionId);
        if (payment == null || !string.Equals(payment.Module, "FOOD", StringComparison.OrdinalIgnoreCase) || payment.OrderId <= 0)
            return;

        var order = await db.FoodOrders.FirstOrDefaultAsync(o => o.Id == payment.OrderId);
        if (order == null || !string.Equals(order.PaymentMethod, "ONLINE", StringComparison.OrdinalIgnoreCase))
            return;

        if (string.Equals(order.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase))
            return;

        if (verified && string.Equals(payment.Status, "PAID", StringComparison.OrdinalIgnoreCase))
        {
            order.PaymentStatus = "PAID";
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return;
        }

        var gateway = (payment.Status ?? "").Trim().ToUpperInvariant();
        if (gateway is "FAILED" or "FAILURE" or "DROPPED" or "BOUNCED")
        {
            order.PaymentStatus = "FAILED";
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        else if (gateway is "CANCELLED" or "USERCANCELLED" or "USER_CANCELLED")
        {
            order.PaymentStatus = "CANCELLED";
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }
}
