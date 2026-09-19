using Microsoft.AspNetCore.SignalR;

namespace SuperApp.API.Hubs;

public class OrderStatusHub : Hub
{
    public async Task JoinOrder(long orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");
    }

    public async Task LeaveOrder(long orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order-{orderId}");
    }

    public async Task UpdateOrderStatus(long orderId, string status, string? message, int? estimatedMinutes)
    {
        await Clients.Group($"order-{orderId}").SendAsync("OrderStatusUpdated", new
        {
            orderId,
            status,
            message,
            estimatedMinutes,
            updatedAt = DateTime.UtcNow
        });
    }
}
