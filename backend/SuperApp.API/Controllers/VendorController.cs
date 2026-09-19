using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

namespace SuperApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class VendorController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<OrderStatusHub> _orderHub;

    public VendorController(AppDbContext db, IHubContext<OrderStatusHub> orderHub)
    {
        _db = db;
        _orderHub = orderHub;
    }

    private async Task<Restaurant?> GetAuthorizedRestaurantAsync()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !long.TryParse(claim.Value, out var userId))
            return null;

        // Check if user is explicitly mapped via RestaurantUsers
        var mapping = await _db.RestaurantUsers
            .Include(ru => ru.Restaurant)
            .FirstOrDefaultAsync(ru => ru.UserId == userId && ru.IsActive);

        if (mapping != null && mapping.Restaurant != null)
            return mapping.Restaurant;

        // System administrators are authorized to access the primary active restaurant
        if (User.IsInRole(RoleNames.Admin))
        {
            return await _db.Restaurants.FirstOrDefaultAsync(r => r.IsActive);
        }

        // Restaurant owner MUST be mapped through RestaurantUsers. No fallback.
        return null;
    }

    /// <summary>
    /// Get vendor restaurant profile
    /// </summary>
    [HttpGet("my-restaurant")]
    public async Task<ActionResult<ApiResponse<RestaurantDetailDto>>> GetMyRestaurant()
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse<RestaurantDetailDto>.Fail("No restaurant associated with this user"));

        return Ok(ApiResponse<RestaurantDetailDto>.Ok(new RestaurantDetailDto
        {
            Id = restaurant.Id,
            Name = restaurant.Name,
            Description = restaurant.Description,
            ImageUrl = restaurant.ImageUrl,
            AddressLine = restaurant.AddressLine,
            City = restaurant.City,
            Rating = restaurant.Rating,
            TotalRatings = restaurant.TotalRatings,
            IsVeg = restaurant.IsVeg,
            MinOrderAmount = restaurant.MinOrderAmount,
            DeliveryFee = restaurant.DeliveryFee,
            AvgDeliveryTimeMinutes = restaurant.AvgDeliveryTimeMinutes,
            IsFeatured = restaurant.IsFeatured,
            OpeningTime = restaurant.OpeningTime,
            ClosingTime = restaurant.ClosingTime
        }));
    }

    /// <summary>
    /// Minimal API: Master CRUD operations for Food Items using action pattern (ADD, EDIT, DELETE, STATUS)
    /// </summary>
    [HttpPost("food-items")]
    public async Task<ActionResult<ApiResponse>> ManageFoodItem([FromBody] VendorFoodItemActionRequest request)
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse.Fail("Restaurant not found"));

        var action = request.Action?.ToUpperInvariant() ?? string.Empty;

        switch (action)
        {
            case "ADD":
                if (string.IsNullOrWhiteSpace(request.Name) || !request.BasePrice.HasValue || !request.RestaurantCategoryId.HasValue)
                    return BadRequest(ApiResponse.Fail("Name, BasePrice, and Category are required"));

                var category = await _db.RestaurantCategories.FirstOrDefaultAsync(c =>
                    c.Id == request.RestaurantCategoryId.Value && c.RestaurantId == restaurant.Id);

                if (category == null)
                    return BadRequest(ApiResponse.Fail("Category does not belong to this restaurant"));

                var newItem = new FoodItem
                {
                    RestaurantId = restaurant.Id,
                    RestaurantCategoryId = request.RestaurantCategoryId.Value,
                    Name = request.Name.Trim(),
                    Description = request.Description,
                    ImageUrl = request.ImageUrl,
                    BasePrice = request.BasePrice.Value,
                    DiscountPercent = request.DiscountPercent ?? 0,
                    IsVeg = request.IsVeg ?? false,
                    IsAvailable = request.IsAvailable ?? true,
                    IsBestseller = request.IsBestseller ?? false,
                    IsCustomizable = request.IsCustomizable ?? false,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _db.FoodItems.Add(newItem);
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Food item added successfully"));

            case "EDIT":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse.Fail("Item Id is required"));

                var item = await _db.FoodItems.FirstOrDefaultAsync(f => f.Id == request.Id.Value && f.RestaurantId == restaurant.Id);
                if (item == null)
                    return NotFound(ApiResponse.Fail("Item not found in this restaurant"));

                if (!string.IsNullOrWhiteSpace(request.Name)) item.Name = request.Name.Trim();
                if (request.Description != null) item.Description = request.Description;
                if (request.ImageUrl != null) item.ImageUrl = request.ImageUrl;
                if (request.BasePrice.HasValue) item.BasePrice = request.BasePrice.Value;
                if (request.DiscountPercent.HasValue) item.DiscountPercent = request.DiscountPercent.Value;
                if (request.IsVeg.HasValue) item.IsVeg = request.IsVeg.Value;
                if (request.IsAvailable.HasValue) item.IsAvailable = request.IsAvailable.Value;
                if (request.IsBestseller.HasValue) item.IsBestseller = request.IsBestseller.Value;
                item.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Food item updated successfully"));

            case "DELETE":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse.Fail("Item Id is required"));

                var toDelete = await _db.FoodItems.FirstOrDefaultAsync(f => f.Id == request.Id.Value && f.RestaurantId == restaurant.Id);
                if (toDelete == null)
                    return NotFound(ApiResponse.Fail("Item not found"));

                toDelete.IsActive = false; // Soft delete
                toDelete.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Food item removed successfully"));

            case "STATUS":
                if (!request.Id.HasValue || !request.IsAvailable.HasValue)
                    return BadRequest(ApiResponse.Fail("Item Id and IsAvailable status are required"));

                var toToggle = await _db.FoodItems.FirstOrDefaultAsync(f => f.Id == request.Id.Value && f.RestaurantId == restaurant.Id);
                if (toToggle == null)
                    return NotFound(ApiResponse.Fail("Item not found"));

                toToggle.IsAvailable = request.IsAvailable.Value;
                toToggle.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok($"Item availability changed to {request.IsAvailable.Value}"));

            default:
                return BadRequest(ApiResponse.Fail($"Unknown action: '{request.Action}'. Expected ADD, EDIT, DELETE, or STATUS"));
        }
    }

    /// <summary>
    /// Get kitchen orders for the vendor
    /// </summary>
    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<List<FoodOrderDto>>>> GetVendorOrders([FromQuery] string? status)
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse<List<FoodOrderDto>>.Fail("Restaurant not found"));

        var query = _db.FoodOrders
            .Include(o => o.Items)
            .Where(o => o.RestaurantId == restaurant.Id)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(o => o.Status.ToUpper() == status.Trim().ToUpper());
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .Select(o => new FoodOrderDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                RestaurantId = o.RestaurantId,
                RestaurantName = restaurant.Name,
                Status = o.Status,
                SubTotal = o.SubTotal,
                DiscountAmount = o.DiscountAmount,
                CouponDiscount = o.CouponDiscount,
                DeliveryFee = o.DeliveryFee,
                TaxAmount = o.TaxAmount,
                GrandTotal = o.GrandTotal,
                PaymentMethod = o.PaymentMethod,
                PaymentStatus = o.PaymentStatus,
                Notes = o.Notes,
                EstimatedDeliveryMinutes = o.EstimatedDeliveryMinutes,
                CreatedAt = o.CreatedAt,
                Items = o.Items.Select(i => new FoodOrderItemDto
                {
                    Id = i.Id,
                    FoodItemId = i.FoodItemId,
                    ItemName = i.ItemName,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    VariantName = i.VariantName,
                    VariantPrice = i.VariantPrice,
                    AddonsSummary = i.AddonsJson,
                    TotalPrice = i.TotalPrice
                }).ToList()
            })
            .ToListAsync();

        return Ok(ApiResponse<List<FoodOrderDto>>.Ok(orders));
    }

    /// <summary>
    /// Update kitchen order status (ACCEPTED, PREPARING, READY, CANCELLED)
    /// </summary>
    [HttpPut("orders/{id:long}/status")]
    public async Task<ActionResult<ApiResponse>> UpdateOrderStatus(long id, [FromBody] UpdateOrderStatusRequest request)
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse.Fail("Restaurant not found or unauthorized"));

        var order = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurant.Id);
        if (order == null)
            return NotFound(ApiResponse.Fail("Order not found for this restaurant"));

        var currentStatus = order.Status.Trim().ToUpperInvariant();
        var targetStatus = request.Status?.Trim().ToUpperInvariant() ?? string.Empty;

        // Valid State Machine Transitions:
        // PENDING -> ACCEPTED, CANCELLED
        // ACCEPTED -> PREPARING, CANCELLED
        // PREPARING -> READY, CANCELLED
        // READY -> PICKED_UP, DELIVERED, CANCELLED
        // PICKED_UP -> DELIVERED, CANCELLED
        bool isValidTransition = (currentStatus, targetStatus) switch
        {
            (OrderStatus.Pending, OrderStatus.Accepted) => true,
            (OrderStatus.Pending, OrderStatus.Cancelled) => true,
            (OrderStatus.Accepted, OrderStatus.Preparing) => true,
            (OrderStatus.Accepted, OrderStatus.Cancelled) => true,
            (OrderStatus.Preparing, OrderStatus.Ready) => true,
            (OrderStatus.Preparing, OrderStatus.Cancelled) => true,
            (OrderStatus.Ready, OrderStatus.PickedUp) => true,
            (OrderStatus.Ready, OrderStatus.Delivered) => true,
            (OrderStatus.Ready, OrderStatus.Cancelled) => true,
            (OrderStatus.PickedUp, OrderStatus.Delivered) => true,
            (OrderStatus.PickedUp, OrderStatus.Cancelled) => true,
            _ => false
        };

        if (!isValidTransition)
            return BadRequest(ApiResponse.Fail($"Invalid status transition from '{currentStatus}' to '{targetStatus}'"));

        order.Status = targetStatus;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Broadcast to customer tracking screen via OrderStatusHub
        await _orderHub.Clients.Group($"order-{order.Id}").SendAsync("OrderStatusUpdated", new
        {
            orderId = order.Id,
            status = targetStatus,
            message = $"Order is now {targetStatus}",
            estimatedMinutes = order.EstimatedDeliveryMinutes,
            updatedAt = DateTime.UtcNow
        });

        return Ok(ApiResponse.Ok($"Order status updated to {targetStatus}"));
    }

    /// <summary>
    /// Get vendor analytics & dashboard metrics
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResponse<VendorDashboardDto>>> GetVendorDashboard()
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse<VendorDashboardDto>.Fail("Restaurant not found"));

        var today = DateTime.UtcNow.Date;

        var orders = await _db.FoodOrders
            .Where(o => o.RestaurantId == restaurant.Id && o.CreatedAt >= today)
            .ToListAsync();

        var activeMenuItems = await _db.FoodItems
            .CountAsync(f => f.RestaurantId == restaurant.Id && f.IsActive && f.IsAvailable);

        var pendingCount = orders.Count(o => o.Status == OrderStatus.Pending || o.Status == OrderStatus.Accepted || o.Status == OrderStatus.Preparing);
        var completedCount = orders.Count(o => o.Status == OrderStatus.Delivered);
        var todaySales = orders.Where(o => o.Status != OrderStatus.Cancelled).Sum(o => o.GrandTotal);

        return Ok(ApiResponse<VendorDashboardDto>.Ok(new VendorDashboardDto
        {
            RestaurantName = restaurant.Name,
            TodayOrdersCount = orders.Count,
            PendingOrdersCount = pendingCount,
            CompletedOrdersCount = completedCount,
            TodaySalesAmount = todaySales,
            ActiveMenuItemsCount = activeMenuItems
        }));
    }

    /// <summary>
    /// Toggle restaurant open/closed status
    /// </summary>
    [HttpPost("toggle-status")]
    public async Task<ActionResult<ApiResponse<bool>>> ToggleStatus([FromBody] ToggleRestaurantStatusRequest request)
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse<bool>.Fail("Restaurant not found"));

        restaurant.IsActive = request.IsOpen;
        restaurant.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(restaurant.IsActive, restaurant.IsActive ? "Restaurant is now OPEN" : "Restaurant is now CLOSED"));
    }

    /// <summary>
    /// Get restaurant menu categories and items for vendor management
    /// </summary>
    [HttpGet("menu")]
    public async Task<ActionResult<ApiResponse<List<RestaurantCategoryDto>>>> GetVendorMenu()
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse<List<RestaurantCategoryDto>>.Fail("Restaurant not found"));

        var categories = await _db.RestaurantCategories
            .Include(c => c.FoodItems.Where(f => f.IsActive))
            .Where(c => c.RestaurantId == restaurant.Id && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new RestaurantCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                SortOrder = c.SortOrder,
                Items = c.FoodItems.Select(f => new FoodItemDto
                {
                    Id = f.Id,
                    RestaurantId = restaurant.Id,
                    RestaurantCategoryId = c.Id,
                    Name = f.Name,
                    Description = f.Description,
                    ImageUrl = f.ImageUrl,
                    BasePrice = f.BasePrice,
                    DiscountPercent = f.DiscountPercent,
                    DiscountedPrice = f.BasePrice * (1 - (f.DiscountPercent / 100m)),
                    IsVeg = f.IsVeg,
                    IsAvailable = f.IsAvailable,
                    IsBestseller = f.IsBestseller,
                    IsCustomizable = f.IsCustomizable
                }).ToList()
            })
            .ToListAsync();

        return Ok(ApiResponse<List<RestaurantCategoryDto>>.Ok(categories));
    }

    /// <summary>
    /// Get vendor settled earnings
    /// </summary>
    [HttpGet("earnings")]
    public async Task<ActionResult<ApiResponse<object>>> GetEarnings()
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse<object>.Fail("Restaurant not found"));

        var deliveredOrders = await _db.FoodOrders
            .Where(o => o.RestaurantId == restaurant.Id && o.Status == OrderStatus.Delivered)
            .ToListAsync();

        var totalRevenue = deliveredOrders.Sum(o => o.SubTotal - o.DiscountAmount);
        var commission = totalRevenue * 0.15m; // 15% platform commission
        var netPayout = totalRevenue - commission;

        return Ok(ApiResponse<object>.Ok(new
        {
            totalOrders = deliveredOrders.Count,
            grossSales = totalRevenue,
            commissionDeducted = commission,
            netEarnings = netPayout,
            settlementStatus = "SETTLED"
        }));
    }

    /// <summary>
    /// Category management for restaurant owner: ADD, EDIT, DELETE
    /// </summary>
    [HttpPost("categories")]
    public async Task<ActionResult<ApiResponse>> ManageCategory([FromBody] VendorCategoryActionRequest request)
    {
        var restaurant = await GetAuthorizedRestaurantAsync();
        if (restaurant == null)
            return NotFound(ApiResponse.Fail("Restaurant not found or unauthorized"));

        var action = request.Action?.ToUpperInvariant() ?? string.Empty;
        switch (action)
        {
            case "ADD":
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest(ApiResponse.Fail("Category Name is required"));

                var newCat = new RestaurantCategory
                {
                    RestaurantId = restaurant.Id,
                    Name = request.Name.Trim(),
                    Description = request.Description?.Trim(),
                    SortOrder = request.SortOrder ?? 0,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _db.RestaurantCategories.Add(newCat);
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Category created successfully"));

            case "EDIT":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse.Fail("Category ID is required for EDIT"));

                var catToEdit = await _db.RestaurantCategories.FirstOrDefaultAsync(c => c.Id == request.Id.Value && c.RestaurantId == restaurant.Id);
                if (catToEdit == null)
                    return NotFound(ApiResponse.Fail("Category not found"));

                if (!string.IsNullOrWhiteSpace(request.Name)) catToEdit.Name = request.Name.Trim();
                if (request.Description != null) catToEdit.Description = request.Description.Trim();
                if (request.SortOrder.HasValue) catToEdit.SortOrder = request.SortOrder.Value;
                catToEdit.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Category updated successfully"));

            case "DELETE":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse.Fail("Category ID is required for DELETE"));

                var catToDelete = await _db.RestaurantCategories.FirstOrDefaultAsync(c => c.Id == request.Id.Value && c.RestaurantId == restaurant.Id);
                if (catToDelete == null)
                    return NotFound(ApiResponse.Fail("Category not found"));

                catToDelete.IsActive = false;
                catToDelete.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Category removed successfully"));

            default:
                return BadRequest(ApiResponse.Fail($"Unknown category action: '{request.Action}'. Use ADD, EDIT, or DELETE."));
        }
    }
}

public class ToggleRestaurantStatusRequest
{
    public bool IsOpen { get; set; }
}

