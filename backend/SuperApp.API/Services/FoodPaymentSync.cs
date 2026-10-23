using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.Hubs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Applies a gateway result onto the food order. PAID is written only when the
/// payment row itself is already PAID after server-side verification.
/// Supports multi-restaurant checkout groups where one payment covers multiple child orders.
/// </summary>
public static class FoodPaymentSync
{
    public static async Task ApplyAsync(AppDbContext db, string? transactionId, bool verified, IHubContext<OrderStatusHub>? orderHub = null)
    {
        if (string.IsNullOrWhiteSpace(transactionId))
            return;

        var payment = await db.Payments.FirstOrDefaultAsync(p => p.TransactionId == transactionId);
        if (payment == null || !string.Equals(payment.Module, "FOOD", StringComparison.OrdinalIgnoreCase) || payment.OrderId <= 0)
            return;

        var primaryOrder = await db.FoodOrders.FirstOrDefaultAsync(o => o.Id == payment.OrderId);
        if (primaryOrder == null || !string.Equals(primaryOrder.PaymentMethod, "ONLINE", StringComparison.OrdinalIgnoreCase))
            return;

        List<FoodOrder> affectedOrders;
        if (!string.IsNullOrEmpty(primaryOrder.CheckoutGroupId))
        {
            affectedOrders = await db.FoodOrders
                .Where(o => o.CheckoutGroupId == primaryOrder.CheckoutGroupId)
                .ToListAsync();
        }
        else
        {
            affectedOrders = new List<FoodOrder> { primaryOrder };
        }

        if (verified && string.Equals(payment.Status, "PAID", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var o in affectedOrders)
            {
                if (string.Equals(o.Status, OrderStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
                {
                    o.PaymentStatus = "REFUND_DUE";
                }
                else
                {
                    o.PaymentStatus = "PAID";
                    if (o.Status == OrderStatus.Pending)
                    {
                        o.Status = OrderStatus.Accepted; // Auto-confirm on successful payment
                    }
                }
                o.UpdatedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();

            if (orderHub != null)
            {
                foreach (var o in affectedOrders)
                {
                    if (string.Equals(o.Status, OrderStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
                        continue;

                    try
                    {
                        var fullOrder = await db.FoodOrders
                            .Include(x => x.Items)
                            .Include(x => x.Restaurant)
                            .Include(x => x.Address)
                            .Include(x => x.User)
                            .FirstOrDefaultAsync(x => x.Id == o.Id);

                        if (fullOrder != null && fullOrder.Restaurant != null)
                        {
                            var dto = FoodOrdersController.MapToOrderDto(fullOrder, fullOrder.Restaurant, fullOrder.Address, fullOrder.User);
                            await orderHub.Clients.Group($"restaurant-{fullOrder.RestaurantId}").SendAsync("NewIncomingOrder", dto);
                        }
                    }
                    catch
                    {
                        // Non-critical notification failure must not rollback payment sync
                    }
                }
            }
            return;
        }

        var gateway = (payment.Status ?? "").Trim().ToUpperInvariant();
        if (gateway is "FAILED" or "FAILURE" or "DROPPED" or "BOUNCED")
        {
            foreach (var o in affectedOrders)
            {
                o.PaymentStatus = "FAILED";
                o.UpdatedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
        }
        else if (gateway is "CANCELLED" or "USERCANCELLED" or "USER_CANCELLED")
        {
            foreach (var o in affectedOrders)
            {
                o.PaymentStatus = "CANCELLED";
                o.UpdatedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
        }
    }
}
