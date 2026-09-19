namespace SuperApp.API.DTOs;

public class CreateReviewRequest
{
    public string TargetType { get; set; } = string.Empty; // RESTAURANT, DRIVER, LISTING
    public long TargetId { get; set; }
    public int Rating { get; set; } // 1-5
    public string? Comment { get; set; }
}

public class ReviewDto
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserAvatar { get; set; }
    public string TargetType { get; set; } = string.Empty;
    public long TargetId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
}
