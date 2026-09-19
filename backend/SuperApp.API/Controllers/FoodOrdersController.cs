using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FoodOrdersController : ControllerBase
{
    private readonly AppDbContext _db;

    public FoodOrdersController(AppDbContext db)
    {
        _db = db;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1; // Default development user
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
            UserId = userId,
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
            PaymentMethod = request.PaymentMethod,
            PaymentStatus = "PENDING",
            Notes = request.Notes,
            EstimatedDeliveryMinutes = restaurant.AvgDeliveryTimeMinutes,
            CreatedAt = DateTime.UtcNow,
            Items = orderItems
        };

        _db.FoodOrders.Add(order);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<FoodOrderDto>.Ok(MapToOrderDto(order, restaurant.Name, restaurant.ImageUrl)));
    }

    /// <summary>
    /// Get food order history for the current user
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<FoodOrderDto>>>> GetMyOrders()
    {
        var userId = GetCurrentUserId();
        var orders = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Items)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .Take(30)
            .ToListAsync();

        var dtos = orders.Select(o => MapToOrderDto(o, o.Restaurant.Name, o.Restaurant.ImageUrl)).ToList();
        return Ok(ApiResponse<List<FoodOrderDto>>.Ok(dtos));
    }

    /// <summary>
    /// Get specific food order details
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<FoodOrderDto>>> GetOrder(long id)
    {
        var order = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Order not found"));

        return Ok(ApiResponse<FoodOrderDto>.Ok(MapToOrderDto(order, order.Restaurant.Name, order.Restaurant.ImageUrl)));
    }

    /// <summary>
    /// Cancel order if it is still pending
    /// </summary>
    [HttpPost("{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse>> CancelOrder(long id)
    {
        var order = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
            return NotFound(ApiResponse.Fail("Order not found"));

        if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Accepted)
            return BadRequest(ApiResponse.Fail("Order cannot be cancelled once it is being prepared or delivered"));

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Order cancelled successfully"));
    }

    private static FoodOrderDto MapToOrderDto(FoodOrder o, string restaurantName, string? restaurantImage)
    {
        return new FoodOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            RestaurantId = o.RestaurantId,
            RestaurantName = restaurantName,
            RestaurantImageUrl = restaurantImage,
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
        };
    }
}
