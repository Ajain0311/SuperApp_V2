using Microsoft.AspNetCore.SignalR;

namespace SuperApp.API.Hubs;

public class ChatHub : Hub
{
    public async Task JoinChat(string conversationId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat-{conversationId}");
    }

    public async Task LeaveChat(string conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat-{conversationId}");
    }

    public async Task SendMessage(string conversationId, long senderId, string senderName, string messageText)
    {
        await Clients.Group($"chat-{conversationId}").SendAsync("MessageReceived", new
        {
            conversationId,
            senderId,
            senderName,
            messageText,
            timestamp = DateTime.UtcNow
        });
    }
}
