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
    /// </summary>
    public static async Task ReleaseCaptainAndNotifyAsync(
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

        var payload = new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            status = OrderStatus.Cancelled,
            driverId = previousDriverId,
            cancelledBy,
            message = "Order cancelled",
            updatedAt = DateTime.UtcNow
        };

        // Clients may be unset in unit tests that only pass a bare hub mock.
        if (orderHub?.Clients != null)
        {
            await orderHub.Clients.Group($"order-{order.Id}").SendAsync("OrderStatusUpdated", payload);
            await orderHub.Clients.Group($"restaurant-{order.RestaurantId}").SendAsync("OrderAcceptedByOther", new
            {
                orderId = order.Id,
                status = OrderStatus.Cancelled,
                updatedAt = DateTime.UtcNow
            });
        }

        if (rideHub?.Clients != null)
        {
            await rideHub.Clients.Group("drivers-pool").SendAsync("FoodDeliveryStatusChanged", payload);
        }
    }
}
