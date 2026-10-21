using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Hubs;

[Authorize]
public class OrderStatusHub : Hub
{
    private readonly AppDbContext _db;

    public OrderStatusHub(AppDbContext db)
    {
        _db = db;
    }

    private long? GetUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    public async Task JoinOrder(long orderId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required to join order tracking");
        }

        var order = await _db.FoodOrders
            .Include(o => o.Driver)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null)
        {
            throw new HubException("Order not found");
        }

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;
        var isCustomer = order.UserId == userId.Value;
        var isDriver = order.Driver != null && order.Driver.UserId == userId.Value;

        var isKitchenOwner = await _db.RestaurantUsers
            .AnyAsync(ru => ru.UserId == userId.Value && ru.RestaurantId == order.RestaurantId && ru.IsActive);

        if (!isAdmin && !isCustomer && !isDriver && !isKitchenOwner)
        {
            throw new HubException("Unauthorized to join this order's tracking channel");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");
    }

    public async Task LeaveOrder(long orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order-{orderId}");
    }

    public async Task UpdateOrderStatus(long orderId, string status, string? message, int? estimatedMinutes)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required to update order status");
        }

        var order = await _db.FoodOrders
            .Include(o => o.Driver)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null)
        {
            throw new HubException("Order not found");
        }

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;
        var isKitchenStaff = await _db.RestaurantUsers
            .AnyAsync(ru => ru.UserId == userId.Value && ru.RestaurantId == order.RestaurantId && ru.IsActive);
        var isDriver = order.Driver != null && order.Driver.UserId == userId.Value;

        if (!isAdmin && !isKitchenStaff && !isDriver)
        {
            throw new HubException("Unauthorized: Only authorized kitchen staff, assigned delivery partners or admins can update order status");
        }

        var normalized = (status ?? "").Trim().ToUpperInvariant();
        // Order status is server-owned and transitions must be executed via authoritative REST endpoints.
        // We enforce that the broadcast status must match the current persisted DB status (unless Admin sync).
        if (!isAdmin && !string.Equals(order.Status, normalized, StringComparison.OrdinalIgnoreCase))
        {
            throw new HubException($"State transition mismatch. Order status is server-owned (current DB status: '{order.Status}'). Use dedicated order endpoints to update order status.");
        }

        await Clients.Group($"order-{orderId}").SendAsync("OrderStatusUpdated", new
        {
            orderId,
            status = order.Status,
            message,
            estimatedMinutes,
            updatedAt = DateTime.UtcNow
        });
    }

    public async Task JoinRestaurantKitchen(long restaurantId)
    {
        var userId = GetUserId();
        if (!userId.HasValue)
        {
            throw new HubException("Authentication required to join restaurant kitchen");
        }

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;
        var isAuthorizedKitchen = await _db.RestaurantUsers
            .AnyAsync(ru => ru.UserId == userId.Value && ru.RestaurantId == restaurantId && ru.IsActive);

        if (!isAdmin && !isAuthorizedKitchen)
        {
            throw new HubException("Unauthorized: Only verified staff/owners mapped to this restaurant can join its kitchen stream");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"restaurant-{restaurantId}");
    }

    public async Task LeaveRestaurantKitchen(long restaurantId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"restaurant-{restaurantId}");
    }
}
