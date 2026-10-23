using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Hubs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

/// <summary>
/// Shared cancel rules for food orders: customer may cancel through READY
/// (including after captain assignment); PICKED_UP and later are blocked.
/// Always clears captain assignment and notifies drivers-pool on cancel.
/// </summary>
public static class FoodOrderCancellation
{
    public static bool CanCustomerCancel(string? status)
    {
        var s = (status ?? string.Empty).Trim().ToUpperInvariant();
        return s is OrderStatus.Pending
            or OrderStatus.Accepted
            or OrderStatus.Preparing
            or OrderStatus.Ready;
    }

    public static bool CanVendorCancel(string? status)
    {
        var s = (status ?? string.Empty).Trim().ToUpperInvariant();
        // Same cut-off as customer: once picked up, cancel is unsafe for the rider.
        return s is OrderStatus.Pending
            or OrderStatus.Accepted
            or OrderStatus.Preparing
            or OrderStatus.Ready;
    }

    /// <summary>
    /// Clear DriverId / DriverAssignedAt and broadcast CANCELLED so captain UIs drop the active job.
    /// Returns the previous driver id (before clear) for stakeholder push.
    /// </summary>
    public static async Task<long?> ReleaseCaptainAndNotifyAsync(
        AppDbContext db,
        FoodOrder order,
        IHubContext<OrderStatusHub>? orderHub,
        IHubContext<RideTrackingHub>? rideHub,
        string cancelledBy)
    {
        var hadCaptain = order.DriverId.HasValue;
        var previousDriverId = order.DriverId;

        if (hadCaptain || order.DriverAssignedAt.HasValue)
        {
            if (db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) == true)
            {
                order.DriverId = null;
                order.DriverAssignedAt = null;
            }
            else
            {
                await db.FoodOrders
                    .Where(o => o.Id == order.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(o => o.DriverId, (long?)null)
                        .SetProperty(o => o.DriverAssignedAt, (DateTime?)null)
                        .SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
                order.DriverId = null;
                order.DriverAssignedAt = null;
                db.Entry(order).Property(o => o.DriverId).IsModified = false;
                db.Entry(order).Property(o => o.DriverAssignedAt).IsModified = false;
            }
        }

        var who = FormatCancelledBy(cancelledBy);
        var payload = new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            status = OrderStatus.Cancelled,
            driverId = previousDriverId,
            cancelledBy,
            message = $"Order cancelled by {who}",
            updatedAt = DateTime.UtcNow
        };

        // Clients may be unset in unit tests that only pass a bare hub mock.
        if (orderHub?.Clients != null)
        {
            await orderHub.Clients.Group($"order-{order.Id}").SendAsync("OrderStatusUpdated", payload);
            await orderHub.Clients.Group($"restaurant-{order.RestaurantId}").SendAsync("OrderAcceptedByOther", new
            {
                orderId = order.Id,
                orderNumber = order.OrderNumber,
                status = OrderStatus.Cancelled,
                cancelledBy,
                message = payload.message,
                updatedAt = DateTime.UtcNow
            });
        }

        if (rideHub?.Clients != null)
        {
            await rideHub.Clients.Group("drivers-pool").SendAsync("FoodDeliveryStatusChanged", payload);
        }

        return previousDriverId;
    }

    /// <summary>
    /// In-app + push for only involved parties: assigned captain, restaurant staff, customer.
    /// No broadcast fanout. Safe when <paramref name="notifications"/> is null (unit tests).
    /// </summary>
    public static async Task NotifyCancelStakeholdersAsync(
        AppDbContext db,
        FoodOrder order,
        long? previousDriverId,
        string cancelledBy,
        INotificationService? notifications,
        long? actingUserId = null)
    {
        if (notifications == null)
            return;

        var who = FormatCancelledBy(cancelledBy);
        var isVendorCancel = string.Equals(cancelledBy, "vendor", StringComparison.OrdinalIgnoreCase);
        var isCustomerCancel = string.Equals(cancelledBy, "customer", StringComparison.OrdinalIgnoreCase);

        if (previousDriverId.HasValue)
        {
            var captainUserId = await db.Drivers.AsNoTracking()
                .Where(d => d.Id == previousDriverId.Value)
                .Select(d => (long?)d.UserId)
                .FirstOrDefaultAsync();

            if (captainUserId.HasValue)
            {
                await notifications.SendPushNotificationAsync(
                    captainUserId.Value,
                    "Food delivery cancelled ❌",
                    $"Order #{order.OrderNumber} cancel ho gaya ({who}). Pickup ab nahi karna.",
                    "FOOD_ORDER",
                    order.OrderNumber);
            }
        }

        var staffIds = await db.RestaurantUsers.AsNoTracking()
            .Where(ru => ru.RestaurantId == order.RestaurantId && ru.IsActive)
            .Select(ru => ru.UserId)
            .Distinct()
            .ToListAsync();

        foreach (var staffId in staffIds)
        {
            // Acting kitchen user already knows they cancelled.
            if (isVendorCancel && actingUserId.HasValue && staffId == actingUserId.Value)
                continue;

            var staffBody = isCustomerCancel
                ? $"Customer ne order #{order.OrderNumber} cancel kar diya."
                : $"Order #{order.OrderNumber} cancel ho gaya.";

            await notifications.SendPushNotificationAsync(
                staffId,
                "Order Cancelled ❌",
                staffBody,
                "FOOD_ORDER",
                order.OrderNumber);
        }

        if (order.UserId > 0)
        {
            if (isVendorCancel)
            {
                await notifications.SendPushNotificationAsync(
                    order.UserId,
                    "Order cancel ho gaya",
                    $"Restaurant ne order #{order.OrderNumber} cancel kar diya.",
                    "FOOD_ORDER",
                    order.OrderNumber);
            }
            else if (isCustomerCancel)
            {
                await notifications.SendPushNotificationAsync(
                    order.UserId,
                    "Order Cancelled",
                    $"Aapka order #{order.OrderNumber} cancel ho chuka hai.",
                    "FOOD_ORDER",
                    order.OrderNumber);
            }
        }
    }

    private static string FormatCancelledBy(string? cancelledBy)
    {
        if (string.Equals(cancelledBy, "vendor", StringComparison.OrdinalIgnoreCase))
            return "restaurant";
        if (string.Equals(cancelledBy, "customer", StringComparison.OrdinalIgnoreCase))
            return "customer";
        return string.IsNullOrWhiteSpace(cancelledBy) ? "system" : cancelledBy.Trim();
    }
}
