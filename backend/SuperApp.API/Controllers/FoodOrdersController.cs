using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SuperApp.API.Hubs;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FoodOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<OrderStatusHub> _orderHub;

    public FoodOrdersController(AppDbContext db, IHubContext<OrderStatusHub> orderHub)
    {
        _db = db;
        _orderHub = orderHub;
    }

    private long? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    /// <summary>
    /// Place a food order with server-side price validation
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<FoodOrderDto>>> PlaceOrder([FromBody] PlaceFoodOrderRequest request)
    {
        if (request.Items == null || !request.Items.Any())
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("At least one food item is required"));

        var restaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.Id == request.RestaurantId && r.IsActive);
        if (restaurant == null)
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Restaurant not found or inactive"));

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<FoodOrderDto>.Fail("Authentication required"));

        var paymentMethod = (request.PaymentMethod ?? "COD").Trim().ToUpperInvariant();
        if (paymentMethod == "CASH") paymentMethod = "COD";
        if (paymentMethod != "COD" && paymentMethod != "ONLINE")
        {
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("Invalid payment method. Supported methods: COD, ONLINE"));
        }

        var initialPaymentStatus = paymentMethod == "ONLINE" ? "PENDING_PAYMENT" : "PENDING";
        var orderItems = new List<FoodOrderItem>();
        decimal subTotal = 0;

        foreach (var itemReq in request.Items)
        {
            var foodItem = await _db.FoodItems
                .Include(f => f.Variants)
                .Include(f => f.Addons)
                .FirstOrDefaultAsync(f => f.Id == itemReq.FoodItemId && f.RestaurantId == request.RestaurantId && f.IsActive);

            if (foodItem == null)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail($"Food item #{itemReq.FoodItemId} not found at this restaurant"));

            if (!foodItem.IsAvailable)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail($"Item '{foodItem.Name}' is currently out of stock"));

            decimal unitPrice = foodItem.DiscountedPrice;
            string? variantName = null;
            decimal variantPrice = 0;

            if (itemReq.VariantId.HasValue)
            {
                var variant = foodItem.Variants.FirstOrDefault(v => v.Id == itemReq.VariantId.Value && v.IsActive);
                if (variant != null)
                {
                    variantName = variant.Name;
                    variantPrice = variant.AdditionalPrice;
                }
            }

            var selectedAddonNames = new List<string>();
            decimal addonsTotal = 0;
            if (itemReq.SelectedAddonIds != null && itemReq.SelectedAddonIds.Any())
            {
                var addons = foodItem.Addons.Where(a => itemReq.SelectedAddonIds.Contains(a.Id) && a.IsActive).ToList();
                foreach (var addon in addons)
                {
                    selectedAddonNames.Add($"{addon.Name} (+₹{addon.Price:F0})");
                    addonsTotal += addon.Price;
                }
            }

            var lineItemPrice = ((unitPrice + variantPrice + addonsTotal) * itemReq.Quantity);
            subTotal += lineItemPrice;

            orderItems.Add(new FoodOrderItem
            {
                FoodItemId = foodItem.Id,
                ItemName = foodItem.Name,
                Quantity = itemReq.Quantity,
                UnitPrice = unitPrice,
                VariantName = variantName,
                VariantPrice = variantPrice,
                AddonsJson = selectedAddonNames.Any() ? JsonSerializer.Serialize(selectedAddonNames) : null,
                TotalPrice = lineItemPrice,
                CreatedAt = DateTime.UtcNow
            });
        }

        // Coupon calculation
        decimal couponDiscount = 0;
        long? couponId = null;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var coupon = await _db.Coupons.FirstOrDefaultAsync(c =>
                c.Code.ToUpper() == request.CouponCode.Trim().ToUpper() && c.IsActive);

            if (coupon != null && DateTime.UtcNow >= coupon.StartDate && DateTime.UtcNow <= coupon.ExpiryDate && subTotal >= coupon.MinOrderAmount)
            {
                couponId = coupon.Id;
                if (coupon.DiscountType.Equals("PERCENTAGE", StringComparison.OrdinalIgnoreCase))
                {
                    couponDiscount = Math.Round(subTotal * (coupon.DiscountValue / 100m), 2);
                    if (coupon.MaxDiscount.HasValue && couponDiscount > coupon.MaxDiscount.Value)
                        couponDiscount = coupon.MaxDiscount.Value;
                }
                else
                {
                    couponDiscount = coupon.DiscountValue;
                }
                couponDiscount = Math.Min(couponDiscount, subTotal);
            }
        }

        var deliveryFee = restaurant.DeliveryFee;
        var taxAmount = Math.Round((subTotal - couponDiscount) * 0.05m, 2); // 5% GST
        var grandTotal = Math.Max(0, subTotal - couponDiscount + deliveryFee + taxAmount);

        var random = new Random();
        var orderNumber = $"FO-{random.Next(1000, 9999)}";

        var order = new FoodOrder
        {
            OrderNumber = orderNumber,
            UserId = userId.Value,
            RestaurantId = restaurant.Id,
            AddressId = request.AddressId,
            Status = OrderStatus.Pending,
            SubTotal = subTotal,
            DiscountAmount = 0,
            CouponId = couponId,
            CouponDiscount = couponDiscount,
            DeliveryFee = deliveryFee,
            TaxAmount = taxAmount,
            GrandTotal = grandTotal,
            PaymentMethod = paymentMethod,
            PaymentStatus = initialPaymentStatus,
            Notes = request.Notes,
            EstimatedDeliveryMinutes = restaurant.AvgDeliveryTimeMinutes,
            CreatedAt = DateTime.UtcNow,
            Items = orderItems
        };

        _db.FoodOrders.Add(order);
        await _db.SaveChangesAsync();

        // Zomato-style witty notification for customer
        try
        {
            var witty = WittyNotificationCatalog.GetRandomLateNightLine();
            _db.Notifications.Add(new Notification
            {
                UserId = userId.Value,
                Title = witty.Title,
                Body = $"{witty.Body} (Order #{order.OrderNumber} placed at {restaurant.Name})",
                Type = "FOOD_ORDER",
                ReferenceId = order.OrderNumber,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
        catch { }

        Address? deliveryAddress = null;
        if (request.AddressId.HasValue)
        {
            deliveryAddress = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == request.AddressId.Value);
        }

        var orderDto = MapToOrderDto(order, restaurant, deliveryAddress);

        // Real-time notification to all active restaurant kitchen staff
        await _orderHub.Clients.Group($"restaurant-{restaurant.Id}").SendAsync("NewIncomingOrder", orderDto);

        return Ok(ApiResponse<FoodOrderDto>.Ok(orderDto));
    }

    /// <summary>
    /// Get food order history for the current user (strictly user-isolated)
    /// </summary>
    [HttpGet]
    [HttpGet("my-orders")]
    public async Task<ActionResult<ApiResponse<List<FoodOrderDto>>>> GetMyOrders()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<List<FoodOrderDto>>.Fail("Authentication required"));

        var orders = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Address)
            .Include(o => o.Items)
            .Where(o => o.UserId == userId.Value)
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .ToListAsync();

        var dtos = orders.Select(o => MapToOrderDto(o, o.Restaurant, o.Address)).ToList();
        return Ok(ApiResponse<List<FoodOrderDto>>.Ok(dtos));
    }

    /// <summary>
    /// Get specific food order details with customer/owner/admin authorization
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<FoodOrderDto>>> GetOrder(long id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<FoodOrderDto>.Fail("Authentication required"));

        var order = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Address)
            .Include(o => o.User)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Order not found"));

        bool isAuthorized = order.UserId == userId.Value || User.IsInRole(RoleNames.Admin);
        if (!isAuthorized)
        {
            var isRestaurantOwner = await _db.RestaurantUsers
                .AnyAsync(ru => ru.UserId == userId.Value && ru.RestaurantId == order.RestaurantId && ru.IsActive);
            if (isRestaurantOwner)
                isAuthorized = true;
        }

        if (!isAuthorized)
            return Forbid();

        return Ok(ApiResponse<FoodOrderDto>.Ok(MapToOrderDto(order, order.Restaurant, order.Address, order.User)));
    }

    /// <summary>
    /// Cancel order if it is still pending
    /// </summary>
    [HttpPost("{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse>> CancelOrder(long id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var order = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
            return NotFound(ApiResponse.Fail("Order not found"));

        if (order.UserId != userId.Value && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Accepted)
            return BadRequest(ApiResponse.Fail("Order cannot be cancelled once it is being prepared or delivered"));

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Order cancelled successfully"));
    }

    private static FoodOrderDto MapToOrderDto(FoodOrder o, Restaurant restaurant, Address? address = null, User? user = null)
    {
        var restPhone = !string.IsNullOrWhiteSpace(restaurant?.Phone) 
            ? restaurant.Phone 
            : "+91 98450 12345";
        var restAddr = !string.IsNullOrWhiteSpace(restaurant?.AddressLine) 
            ? $"{restaurant.AddressLine}, {restaurant.City}" 
            : restaurant?.City ?? "Central Delhi";
        var deliveryAddr = address != null 
            ? $"{address.AddressLine1}, {address.City} ({address.PinCode})" 
            : null;

        return new FoodOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            RestaurantId = o.RestaurantId,
            RestaurantName = restaurant?.Name ?? "Restaurant",
            RestaurantImageUrl = restaurant?.ImageUrl,
            RestaurantPhone = restPhone,
            RestaurantAddress = restAddr,
            DeliveryAddress = deliveryAddr,
            CustomerPhone = user?.MobileNumber,
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
            EstimatedDeliveryMinutes = o.EstimatedDeliveryMinutes ?? (restaurant?.AvgDeliveryTimeMinutes ?? 25),
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
        };
    }
}
