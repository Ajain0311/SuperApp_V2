using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

/// <summary>
/// User image stored in PostgreSQL. BlobObject is compressed JPEG bytes, not a file path.
/// </summary>
public class AppDocument
{
    [Key]
    public long Id { get; set; }

    [Required, MaxLength(40)]
    public string DocumentNo { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string DocumentName { get; set; } = string.Empty;

    [Required]
    public byte[] BlobObject { get; set; } = Array.Empty<byte>();

    public byte[]? ThumbObject { get; set; }

    public long OwnerUserId { get; set; }

    [ForeignKey(nameof(OwnerUserId))]
    public User Owner { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
