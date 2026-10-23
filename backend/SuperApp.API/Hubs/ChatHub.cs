using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly AppDbContext _db;

    public ChatHub(AppDbContext db)
    {
        _db = db;
    }

    private long? GetCurrentUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    public async Task JoinChat(string conversationId)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue || !long.TryParse(conversationId, out var convId))
        {
            throw new HubException("Unauthorized to access this conversation");
        }

        var conv = await _db.ChatConversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == convId);
        if (conv == null)
        {
            throw new HubException("Conversation not found");
        }

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;
        if (conv.BuyerId != currentUserId.Value && conv.SellerId != currentUserId.Value && !isAdmin)
        {
            throw new HubException("You are not a participant in this conversation");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"chat-{conversationId}");
    }

    public async Task LeaveChat(string conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat-{conversationId}");
    }

    public async Task SendMessage(string conversationId, string messageText)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue || !long.TryParse(conversationId, out var convId))
        {
            throw new HubException("Unauthorized to send message");
        }

        if (string.IsNullOrWhiteSpace(messageText))
        {
            throw new HubException("Message cannot be empty");
        }

        var conv = await _db.ChatConversations.FirstOrDefaultAsync(c => c.Id == convId);
        if (conv == null)
        {
            throw new HubException("Conversation not found");
        }

        var isAdmin = Context.User?.IsInRole(RoleNames.Admin) ?? false;
        if (conv.BuyerId != currentUserId.Value && conv.SellerId != currentUserId.Value && !isAdmin)
        {
            throw new HubException("You are not a participant in this conversation");
        }

        var sender = await _db.Users.FindAsync(currentUserId.Value);
        if (sender == null)
        {
            throw new HubException("Sender not found");
        }

        var trimmedText = messageText.Trim();
        var recentCutoff = DateTime.UtcNow.AddSeconds(-5);
        var existingRecentMsg = await _db.ChatMessages
            .Where(m => m.ConversationId == conv.Id && m.SenderId == currentUserId.Value && m.MessageText == trimmedText && m.CreatedAt >= recentCutoff)
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

        ChatMessage msg;
        if (existingRecentMsg != null)
        {
            msg = existingRecentMsg;
        }
        else
        {
            msg = new ChatMessage
            {
                ConversationId = conv.Id,
                SenderId = currentUserId.Value,
                MessageText = trimmedText,
                CreatedAt = DateTime.UtcNow
            };

            _db.ChatMessages.Add(msg);
            conv.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        await Clients.Group($"chat-{conversationId}").SendAsync("MessageReceived", new
        {
            id = msg.Id,
            conversationId,
            senderId = msg.SenderId,
            senderName = sender.FullName,
            messageText = msg.MessageText,
            timestamp = msg.CreatedAt
        });
    }
}
