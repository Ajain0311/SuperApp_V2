namespace SuperApp.API.DTOs;

public class AdminDashboardDto
{
    public int TotalUsers { get; set; }
    public int ActiveDrivers { get; set; }
    public int TotalRestaurants { get; set; }
    public int TotalFoodOrders { get; set; }
    public int TotalRides { get; set; }
    public int ActiveListings { get; set; }
    public decimal GrossFoodSales { get; set; }
    public decimal GrossRideFares { get; set; }
    public decimal PlatformRevenue { get; set; }
    public List<RecentActivityDto> RecentActivities { get; set; } = new();
}

public class RecentActivityDto
{
    public string Id { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty; // FOOD, RIDE, MARKETPLACE, USER
    public string Description { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}

public class AdminUserDto
{
    public long Id { get; set; }
    public string MobileNumber { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Roles { get; set; } = new();
}

public class AdminUserActionRequest
{
    public string Action { get; set; } = "STATUS"; // STATUS, ROLE, REMOVE_ROLE
    public long UserId { get; set; }
    public bool? IsActive { get; set; }
    public string? RoleName { get; set; }
    public long? RestaurantId { get; set; }
    public string? AdminPassword { get; set; }
}

public class AdminAssignProfileRequest
{
    public long UserId { get; set; }
    public string? MobileNumber { get; set; }
    public string? FullName { get; set; }
    public string? Role { get; set; }
    public string? AdminPassword { get; set; }
    public List<string> Roles { get; set; } = new();
    public string? RestaurantName { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Phone { get; set; }
    public string? Cuisine { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? LicenseNumber { get; set; }
    public string? VehicleType { get; set; }
}

public class AdminRestaurantActionRequest
{
    public string Action { get; set; } = "ADD"; // ADD, EDIT, DELETE, STATUS, FEATURED
    public long? Id { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Phone { get; set; }
    public string? AddressLine { get; set; }
    public string? City { get; set; }
    public bool? IsVeg { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsFeatured { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public decimal? DeliveryFee { get; set; }
}

public class AdminDriverActionRequest
{
    public string Action { get; set; } = "VERIFY"; // VERIFY, STATUS
    public long DriverId { get; set; }
    public bool? IsVerified { get; set; }
    public bool? IsActive { get; set; }
}

public class AdminCouponActionRequest
{
    public string Action { get; set; } = "ADD"; // ADD, EDIT, DELETE, STATUS
    public long? Id { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? DiscountType { get; set; } = "PERCENTAGE"; // PERCENTAGE, FLAT
    public decimal? DiscountValue { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public decimal? MaxDiscount { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public int? TotalUsageLimit { get; set; }
    public int? PerUserLimit { get; set; }
    public string? ApplicableModule { get; set; } = "FOOD"; // FOOD, RIDE, MARKETPLACE, ALL
    public long? ApplicableRestaurantId { get; set; }
    public bool? IsActive { get; set; }
}

public class AdminBannerActionRequest
{
    public string Action { get; set; } = "ADD"; // ADD, EDIT, DELETE, STATUS
    public long? Id { get; set; }
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string? CtaText { get; set; }
    public string? Module { get; set; } = "HOME"; // HOME, FOOD, RIDE, MARKETPLACE
    public string? TargetType { get; set; }
    public string? TargetId { get; set; }
    public int? SortOrder { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool? IsActive { get; set; }
}

public class AdminListingActionRequest
{
    public string Action { get; set; } = "STATUS"; // STATUS, FEATURED, EDIT, DELETE
    public long ListingId { get; set; }
    public string? Status { get; set; } // ACTIVE, SOLD, REMOVED
    public bool? IsFeatured { get; set; }
    public string? Title { get; set; }
    public decimal? Price { get; set; }
    public string? Description { get; set; }
}

public class AdminMarketplaceListingDto
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsFeatured { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public long SellerId { get; set; }
    public string SellerName { get; set; } = string.Empty;
    public string? SellerPhone { get; set; }
    public string? PrimaryImageUrl { get; set; }
    public string? Location { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminFoodItemDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal DiscountedPrice { get; set; }
    public bool IsAvailable { get; set; }
    public bool IsActive { get; set; }
    public bool IsVeg { get; set; }
    public string? ImageUrl { get; set; }
    public long RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public string? CategoryName { get; set; }
    public string? OwnerName { get; set; }
    public string? OwnerPhone { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminFoodItemActionRequest
{
    public string Action { get; set; } = "STATUS"; // STATUS, EDIT, DELETE
    public long FoodItemId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? BasePrice { get; set; }
    public decimal? DiscountPercent { get; set; }
    public bool? IsAvailable { get; set; }
    public bool? IsActive { get; set; }
}

public class AdminFoodOrderDto
{
    public long Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public long RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public long UserId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public decimal ItemTotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string PaymentStatus { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int ItemsCount { get; set; }
}

public class AdminRideDto
{
    public long Id { get; set; }
    public string RideNumber { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
    public string PickupAddress { get; set; } = string.Empty;
    public string DropoffAddress { get; set; } = string.Empty;
    public decimal DistanceKm { get; set; }
    public decimal EstimatedFare { get; set; }
    public decimal? ActualFare { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string PaymentStatus { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? DriverName { get; set; }
    public string? DriverPhone { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminSettingDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
}

public class UpdateSettingRequest
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class AdminReportDto
{
    public decimal TotalFoodSales { get; set; }
    public decimal TotalRideFares { get; set; }
    public decimal TotalPlatformEarnings { get; set; }
    public int TotalCompletedOrders { get; set; }
    public int TotalCompletedRides { get; set; }
    public List<TopPerformerDto> TopRestaurants { get; set; } = new();
    public List<TopPerformerDto> TopDrivers { get; set; } = new();
}

public class HotelCommissionSummaryDto
{
    public long RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public decimal ConfiguredRatePercent { get; set; }
    public decimal GrossDeliveredSales { get; set; }
    public decimal TotalCommissionEarned { get; set; }
    public decimal PendingCommissionBalance { get; set; }
    public decimal SettledCommissionAmount { get; set; }
    public int DeliveredOrdersCount { get; set; }
}

public class HotelCommissionLedgerEntryDto
{
    public long Id { get; set; }
    public long RestaurantId { get; set; }
    public string RestaurantName { get; set; } = string.Empty;
    public long FoodOrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal CommissionBaseAmount { get; set; }
    public decimal CommissionRatePercent { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetHotelProceeds { get; set; }
    public decimal PlatformFundedDiscount { get; set; }
    public string Status { get; set; } = string.Empty;
    public long? SettlementBatchId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SettledAt { get; set; }
}

public class CreateSettlementBatchRequest
{
    public long RestaurantId { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public string? ReferenceProof { get; set; }
}

public class ApproveSettlementBatchRequest
{
    public string? ReferenceProof { get; set; }
}

public class UpdateHotelCommissionRateRequest
{
    public long RestaurantId { get; set; }
    public decimal CommissionRatePercent { get; set; }
}

public class TopPerformerDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Revenue { get; set; }
    public int TotalCount { get; set; }
    public decimal Rating { get; set; }
}

public class BroadcastNotificationRequest
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? TargetRole { get; set; } // null/empty = ALL, or CUSTOMER, DRIVER, RESTAURANT_OWNER, MARKETPLACE_SELLER
    /// <summary>How long the home marquee stays visible (1–168 hours). Null uses AppSetting broadcast_default_display_hours.</summary>
    public int? DisplayHours { get; set; }
}
