using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.DTOs;

// --- Restaurant DTOs ---

public class RestaurantSummaryDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public decimal Rating { get; set; }
    public int TotalRatings { get; set; }
    public bool IsVeg { get; set; }
    public decimal MinOrderAmount { get; set; }
    public decimal DeliveryFee { get; set; }
    public int AvgDeliveryTimeMinutes { get; set; }
    public bool IsFeatured { get; set; }
    public string? Cuisines { get; set; }
    public string? OfferText { get; set; }
}

public class RestaurantDetailDto : RestaurantSummaryDto
{
    public TimeSpan? OpeningTime { get; set; }
    public TimeSpan? ClosingTime { get; set; }
    public List<RestaurantCategoryDto> Categories { get; set; } = new();
}

public class RestaurantCategoryDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public List<FoodItemDto> Items { get; set; } = new();
}

public class FoodItemDto
{
    public long Id { get; set; }
    public long RestaurantId { get; set; }
    public long RestaurantCategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal BasePrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal DiscountedPrice { get; set; }
    public bool IsVeg { get; set; }
    public bool IsAvailable { get; set; }
    public bool IsBestseller { get; set; }
    public bool IsCustomizable { get; set; }
    public List<FoodItemVariantDto> Variants { get; set; } = new();
    public List<FoodItemAddonDto> Addons { get; set; } = new();
}

public class FoodItemVariantDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal AdditionalPrice { get; set; }
    public bool IsDefault { get; set; }
}

public class FoodItemAddonDto
{
    public long Id { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool IsDefault { get; set; }
}

// --- Order DTOs ---

public class PlaceFoodOrderRequest
{
    [Required]
    public long RestaurantId { get; set; }
    public long? AddressId { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? CouponCode { get; set; }
    public string PaymentMethod { get; set; } = "COD";
    public string? Notes { get; set; }
    [Required]
    public List<OrderItemRequest> Items { get; set; } = new();
}

public class OrderItemRequest
{
    [Required]
    public long FoodItemId { get; set; }
    public int Quantity { get; set; } = 1;
    public long? VariantId { get; set; }
    public List<long> SelectedAddonIds { get; set; } = new();
}

public class FoodOrderDto
{
    public long Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public long RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public string? RestaurantImageUrl { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal CouponDiscount { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string? PaymentMethod { get; set; }
    public string PaymentStatus { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int? EstimatedDeliveryMinutes { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<FoodOrderItemDto> Items { get; set; } = new();
}

public class FoodOrderItemDto
{
    public long Id { get; set; }
    public long FoodItemId { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? VariantName { get; set; }
    public decimal VariantPrice { get; set; }
    public string? AddonsSummary { get; set; }
    public decimal TotalPrice { get; set; }
}

// --- Coupon DTOs ---

public class ValidateCouponRequest
{
    [Required]
    public string Code { get; set; } = string.Empty;
    public decimal OrderAmount { get; set; }
    public string Module { get; set; } = "FOOD";
}

public class CouponValidationResult
{
    public bool IsValid { get; set; }
    public string Message { get; set; } = string.Empty;
    public decimal DiscountAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public string? Code { get; set; }
}

// --- Vendor DTOs ---

public class VendorFoodItemActionRequest : ActionRequest
{
    public long? Id { get; set; }
    public long? RestaurantCategoryId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal? BasePrice { get; set; }
    public decimal? DiscountPercent { get; set; }
    public bool? IsVeg { get; set; }
    public bool? IsAvailable { get; set; }
    public bool? IsBestseller { get; set; }
    public bool? IsCustomizable { get; set; }
}

public class UpdateOrderStatusRequest
{
    [Required]
    public string Status { get; set; } = string.Empty;
}

public class VendorDashboardDto
{
    public string RestaurantName { get; set; } = string.Empty;
    public int TodayOrdersCount { get; set; }
    public int PendingOrdersCount { get; set; }
    public int CompletedOrdersCount { get; set; }
    public decimal TodaySalesAmount { get; set; }
    public int ActiveMenuItemsCount { get; set; }
    public List<FoodOrderDto> RecentOrders { get; set; } = new();
}
