namespace SuperApp.API.DTOs;

public class MarketplaceCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? IconUrl { get; set; }
    public int ListingCount { get; set; }
}

public class ListingSummaryDto
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Condition { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? PrimaryImageUrl { get; set; }
    public bool IsFeatured { get; set; }
    public int ViewCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public bool IsFavorite { get; set; }
}

public class ListingDetailDto
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Condition { get; set; } = string.Empty;
    public string? Location { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsFeatured { get; set; }
    public int ViewCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public long SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string? SellerPhone { get; set; }
    public string? SellerAvatar { get; set; }
    public DateTime? SellerJoinedAt { get; set; }
    public bool IsFavorite { get; set; }
    public List<string> Images { get; set; } = new();
}

public class ListingActionRequest
{
    public string Action { get; set; } = "ADD"; // ADD, EDIT, DELETE, STATUS
    public long? Id { get; set; }
    public int? CategoryId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Condition { get; set; } = "USED"; // NEW, LIKE_NEW, USED, FAIR
    public string? Location { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Status { get; set; } = "ACTIVE"; // ACTIVE, SOLD, EXPIRED, REMOVED
    public List<string>? ImageUrls { get; set; }
}
