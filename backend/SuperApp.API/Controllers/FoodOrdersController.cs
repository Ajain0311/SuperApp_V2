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
    private readonly IPaymentService? _payments;

    public FoodOrdersController(AppDbContext db, IHubContext<OrderStatusHub> orderHub, IPaymentService? payments = null)
    {
        _db = db;
        _orderHub = orderHub;
        _payments = payments;
    }

    private static void ApplyCouponTotals(FoodOrder order, long? couponId, decimal couponDiscount, decimal deliveryFee, decimal subTotal)
    {
        var taxAmount = Math.Round((subTotal - couponDiscount) * 0.05m, 2);
        order.CouponId = couponId;
        order.CouponDiscount = couponDiscount;
        order.TaxAmount = taxAmount;
        order.GrandTotal = Math.Max(0, subTotal - couponDiscount + deliveryFee + taxAmount);
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

        if (!request.AddressId.HasValue || request.AddressId.Value <= 0)
        {
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("Delivery address is required for placing a food order"));
        }

        var validatedAddress = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == request.AddressId.Value);
        if (validatedAddress == null)
        {
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Specified delivery address not found"));
        }

        if (!validatedAddress.IsActive)
        {
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("Specified delivery address is inactive"));
        }

        if (validatedAddress.UserId != userId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<FoodOrderDto>.Fail("Unauthorized: Delivery address belongs to another customer"));
        }

        if (string.IsNullOrWhiteSpace(validatedAddress.AddressLine1) || string.IsNullOrWhiteSpace(validatedAddress.City))
        {
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("Delivery address is incomplete (missing street line or city)"));
        }

        var initialPaymentStatus = paymentMethod == "ONLINE" ? "PENDING_PAYMENT" : "PENDING";
        var orderItems = new List<FoodOrderItem>();
        decimal subTotal = 0;

        // Enforce sensible limits on cart size
        if (request.Items.Count > 50)
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("Cart size exceeds maximum limit of 50 items"));

        int totalQuantity = 0;
        foreach (var itemReq in request.Items)
        {
            if (itemReq.Quantity <= 0)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail($"Quantity for item #{itemReq.FoodItemId} must be at least 1"));

            if (itemReq.Quantity > 30)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail($"Quantity for item #{itemReq.FoodItemId} exceeds maximum limit of 30 per line item"));

            totalQuantity += itemReq.Quantity;
            if (totalQuantity > 100)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail("Total order item quantity exceeds maximum limit of 100"));

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
                if (variant == null)
                {
                    return BadRequest(ApiResponse<FoodOrderDto>.Fail($"Variant #{itemReq.VariantId.Value} is invalid or inactive for item '{foodItem.Name}'"));
                }
                variantName = variant.Name;
                variantPrice = variant.AdditionalPrice;
            }

            var selectedAddonNames = new List<string>();
            decimal addonsTotal = 0;
            if (itemReq.SelectedAddonIds != null && itemReq.SelectedAddonIds.Any())
            {
                // De-duplicate add-on IDs to prevent duplicate billing
                var distinctAddonIds = itemReq.SelectedAddonIds.Distinct().ToList();
                var addons = foodItem.Addons.Where(a => distinctAddonIds.Contains(a.Id) && a.IsActive).ToList();

                if (addons.Count != distinctAddonIds.Count)
                {
                    return BadRequest(ApiResponse<FoodOrderDto>.Fail($"One or more selected add-ons are invalid or inactive for item '{foodItem.Name}'"));
                }

                foreach (var addon in addons)
                {
                    selectedAddonNames.Add($"{addon.Name} (+₹{addon.Price:F0})");
                    addonsTotal += addon.Price;
                }
            }

            var itemCostPerUnit = unitPrice + variantPrice + addonsTotal;
            if (itemCostPerUnit < 0)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail($"Invalid unit cost for item '{foodItem.Name}'"));

            var lineItemPrice = (itemCostPerUnit * itemReq.Quantity);
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

        var deliveryFee = restaurant.DeliveryFee;
        var orderNumber = $"FO-{Guid.NewGuid().ToString("N")[..16]}";
        var order = new FoodOrder
        {
            OrderNumber = orderNumber,
            UserId = userId.Value,
            RestaurantId = restaurant.Id,
            AddressId = request.AddressId,
            Status = OrderStatus.Pending,
            SubTotal = subTotal,
            DiscountAmount = 0,
            DeliveryFee = deliveryFee,
            PaymentMethod = paymentMethod,
            PaymentStatus = initialPaymentStatus,
            Notes = request.Notes,
            EstimatedDeliveryMinutes = restaurant.AvgDeliveryTimeMinutes,
            CreatedAt = DateTime.UtcNow,
            Items = orderItems
        };

        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var quote = await CouponEngine.ConsumeForOrderAsync(
                _db, request.CouponCode, "FOOD", subTotal, restaurant.Id, userId.Value, async applied =>
                {
                    ApplyCouponTotals(order, applied.Coupon!.Id, applied.DiscountAmount, deliveryFee, subTotal);
                    _db.FoodOrders.Add(order);
                    await _db.SaveChangesAsync();
                    var usage = _db.ChangeTracker.Entries<CouponUsage>()
                        .Select(e => e.Entity)
                        .FirstOrDefault(u => u.CouponId == applied.Coupon.Id && u.UserId == userId.Value && u.OrderId == null);
                    if (usage != null)
                    {
                        usage.OrderId = order.Id;
                        await _db.SaveChangesAsync();
                    }
                });
            if (!quote.IsValid || quote.Coupon == null)
                return BadRequest(ApiResponse<FoodOrderDto>.Fail(quote.Message));
        }
        else
        {
            ApplyCouponTotals(order, null, 0, deliveryFee, subTotal);
            _db.FoodOrders.Add(order);
            await _db.SaveChangesAsync();
        }

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

        var ownerPhone = await ResolveRestaurantOwnerPhoneAsync(restaurant.Id, restaurant.Phone);
        var orderDto = MapToOrderDto(order, restaurant, validatedAddress, ownerPhone: ownerPhone);

        // Real-time notification to all active restaurant kitchen staff:
        // Only dispatch immediately if COD or already PAID. Unpaid online orders await verified payment callback.
        if (order.PaymentMethod == "COD" || order.PaymentStatus == "PAID")
        {
            try
            {
                await _orderHub.Clients.Group($"restaurant-{restaurant.Id}").SendAsync("NewIncomingOrder", orderDto);
            }
            catch
            {
                // Non-critical notification failure must not rollback or fail a confirmed order
            }
        }

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
            .Include(o => o.Driver).ThenInclude(d => d!.User)
            .Where(o => o.UserId == userId.Value)
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .ToListAsync();

        var ownerPhones = await ResolveRestaurantOwnerPhonesAsync(
            orders.Select(o => o.RestaurantId).Distinct().ToList());
        var dtos = orders
            .Select(o => MapToOrderDto(
                o,
                o.Restaurant,
                o.Address,
                ownerPhone: ownerPhones.GetValueOrDefault(o.RestaurantId)))
            .ToList();
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
            .Include(o => o.Driver).ThenInclude(d => d!.User)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Order not found"));

        bool isAuthorized = order.UserId == userId.Value || User.IsInRole(RoleNames.Admin);
        if (!isAuthorized && order.Driver != null && order.Driver.UserId == userId.Value)
            isAuthorized = true;
        if (!isAuthorized)
        {
            var isRestaurantOwner = await _db.RestaurantUsers
                .AnyAsync(ru => ru.UserId == userId.Value && ru.RestaurantId == order.RestaurantId && ru.IsActive);
            if (isRestaurantOwner)
                isAuthorized = true;
        }

        if (!isAuthorized)
            return Forbid();

        var ownerPhone = await ResolveRestaurantOwnerPhoneAsync(order.RestaurantId, order.Restaurant?.Phone);
        return Ok(ApiResponse<FoodOrderDto>.Ok(
            MapToOrderDto(order, order.Restaurant, order.Address, order.User, ownerPhone)));
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

        // If an online payment is already settled, initiate refund and mark order accordingly
        if (string.Equals(order.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase))
        {
            var paidPayment = await _db.Payments
                .Where(p => p.OrderId == order.Id && p.Module == "FOOD" && p.Status == "PAID")
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            if (paidPayment != null && !string.IsNullOrWhiteSpace(paidPayment.TransactionId) && _payments != null)
            {
                var refundResult = await _payments.RefundPaymentAsync(paidPayment.TransactionId, order.GrandTotal, "Order cancelled by customer");
                if (refundResult.Success)
                {
                    order.PaymentStatus = "REFUNDED";
                }
                else
                {
                    order.PaymentStatus = "REFUND_PENDING";
                }
            }
            else
            {
                order.PaymentStatus = "REFUND_PENDING";
            }
        }
        else
        {
            order.PaymentStatus = "CANCELLED";
        }

        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Order cancelled successfully"));
    }

    /// <summary>
    /// Start an Easebuzz (or configured gateway) session for an ONLINE food order.
    /// The order stays PENDING_PAYMENT until the gateway verifies the payment.
    /// </summary>
    [HttpPost("{id:long}/pay")]
    public async Task<ActionResult<ApiResponse<PaymentOrderResult>>> StartOnlinePayment(long id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<PaymentOrderResult>.Fail("Authentication required"));
        if (_payments == null)
            return StatusCode(503, ApiResponse<PaymentOrderResult>.Fail("Payment service is not configured"));

        var order = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
            return NotFound(ApiResponse<PaymentOrderResult>.Fail("Order not found"));
        if (order.UserId != userId.Value)
            return Forbid();
        if (!string.Equals(order.PaymentMethod, "ONLINE", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail("This order is not an online payment"));
        if (string.Equals(order.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase))
            return Conflict(ApiResponse<PaymentOrderResult>.Fail("This order is already paid"));
        if (order.Status == OrderStatus.Cancelled)
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail("Cancelled orders cannot be paid"));
        if (order.GrandTotal < 1)
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail("Order amount must be at least ₹1"));

        var result = await _payments.CreatePaymentOrderAsync(order.GrandTotal, "INR", order.Id.ToString(), "FOOD", userId.Value);
        if (!result.Success)
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail(result.ErrorMessage ?? "Could not start payment"));

        return Ok(ApiResponse<PaymentOrderResult>.Ok(result, "Complete payment in Easebuzz. The order is paid only after verification."));
    }

    private async Task<string?> ResolveRestaurantOwnerPhoneAsync(long restaurantId, string? restaurantPhone)
    {
        var map = await ResolveRestaurantOwnerPhonesAsync(new List<long> { restaurantId });
        if (map.TryGetValue(restaurantId, out var resolved) && !string.IsNullOrWhiteSpace(resolved))
            return resolved;
        return string.IsNullOrWhiteSpace(restaurantPhone) ? null : restaurantPhone.Trim();
    }

    private async Task<Dictionary<long, string?>> ResolveRestaurantOwnerPhonesAsync(IReadOnlyList<long> restaurantIds)
    {
        var result = new Dictionary<long, string?>();
        if (restaurantIds.Count == 0)
            return result;

        var phones = await _db.Restaurants.AsNoTracking()
            .Where(r => restaurantIds.Contains(r.Id))
            .Select(r => new { r.Id, r.Phone })
            .ToDictionaryAsync(r => r.Id, r => r.Phone);

        var links = await _db.RestaurantUsers
            .AsNoTracking()
            .Where(ru => restaurantIds.Contains(ru.RestaurantId) && ru.IsActive)
            .Include(ru => ru.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
            .OrderBy(ru => ru.CreatedAt)
            .ToListAsync();

        foreach (var restaurantId in restaurantIds)
        {
            phones.TryGetValue(restaurantId, out var restaurantPhone);
            var owners = links
                .Where(l => l.RestaurantId == restaurantId
                    && l.User != null
                    && l.User.UserRoles.Any(ur => ur.Role != null && ur.Role.Name == RoleNames.RestaurantOwner))
                .Select(l => (l.User!.MobileNumber, l.User.FullName))
                .ToList();

            result[restaurantId] = RestaurantContactResolver.ResolveOwnerPhone(restaurantPhone, owners);
        }

        return result;
    }

    public static FoodOrderDto MapToOrderDto(
        FoodOrder o,
        Restaurant restaurant,
        Address? address = null,
        User? user = null,
        string? ownerPhone = null)
    {
        // Prefer linked RESTAURANT_OWNER mobile when provided; otherwise restaurants.phone.
        var restPhone = !string.IsNullOrWhiteSpace(ownerPhone)
            ? ownerPhone.Trim()
            : (!string.IsNullOrWhiteSpace(restaurant?.Phone) ? restaurant.Phone : null);
        var restAddr = !string.IsNullOrWhiteSpace(restaurant?.AddressLine) 
            ? (!string.IsNullOrWhiteSpace(restaurant?.City) ? $"{restaurant.AddressLine}, {restaurant.City}" : restaurant.AddressLine)
            : (!string.IsNullOrWhiteSpace(restaurant?.City) ? restaurant.City : null);
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
            DriverId = o.DriverId,
            DriverName = o.Driver?.User?.FullName,
            DriverPhone = o.Driver?.User?.MobileNumber,
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
