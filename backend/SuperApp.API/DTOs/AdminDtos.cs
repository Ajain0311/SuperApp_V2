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
    public string Action { get; set; } = "STATUS"; // STATUS, ROLE
    public long UserId { get; set; }
    public bool? IsActive { get; set; }
    public string? RoleName { get; set; }
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
    public string? Description { get; set; }
    public string? DiscountType { get; set; } = "PERCENTAGE"; // PERCENTAGE, FLAT
    public decimal? DiscountValue { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public decimal? MaxDiscount { get; set; }
    public string? ApplicableModule { get; set; } = "FOOD"; // FOOD, RIDE, ALL
    public bool? IsActive { get; set; }
}

public class AdminBannerActionRequest
{
    public string Action { get; set; } = "ADD"; // ADD, EDIT, DELETE, STATUS
    public long? Id { get; set; }
    public string? Title { get; set; }
    public string? ImageUrl { get; set; }
    public string? Module { get; set; } = "HOME"; // HOME, FOOD, RIDE, MARKETPLACE
    public string? TargetType { get; set; }
    public string? TargetId { get; set; }
    public bool? IsActive { get; set; }
}

public class AdminListingActionRequest
{
    public string Action { get; set; } = "STATUS"; // STATUS, FEATURED, DELETE
    public long ListingId { get; set; }
    public string? Status { get; set; } // ACTIVE, SOLD, REMOVED
    public bool? IsFeatured { get; set; }
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
}
