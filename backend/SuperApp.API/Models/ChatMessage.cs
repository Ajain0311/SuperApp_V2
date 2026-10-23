using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

public class ChatMessage
{
    [Key]
    public long Id { get; set; }

    public long ConversationId { get; set; }

    [ForeignKey(nameof(ConversationId))]
    public ChatConversation Conversation { get; set; } = null!;

    public long SenderId { get; set; }

    [ForeignKey(nameof(SenderId))]
    public User Sender { get; set; } = null!;

    [Required]
    [MaxLength(2000)]
    public string MessageText { get; set; } = string.Empty;

    [MaxLength(100)]
    [Column("client_message_id")]
    public string? ClientMessageId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
