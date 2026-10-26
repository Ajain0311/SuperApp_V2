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
    private readonly IHubContext<RideTrackingHub>? _rideHub;
    private readonly IPaymentService? _payments;
    private readonly INotificationService? _notifications;

    public FoodOrdersController(
        AppDbContext db,
        IHubContext<OrderStatusHub> orderHub,
        IPaymentService? payments = null,
        IHubContext<RideTrackingHub>? rideHub = null,
        INotificationService? notifications = null)
    {
        _db = db;
        _orderHub = orderHub;
        _payments = payments;
        _rideHub = rideHub;
        _notifications = notifications;
    }

    /// <summary>Postgres text rejects U+0000; strip control NULs so notes never 500.</summary>
    private static string? SanitizeNotes(string? notes)
    {
        if (string.IsNullOrEmpty(notes)) return notes;
        return notes.Replace("\0", string.Empty, StringComparison.Ordinal);
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

        var restaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.Id == request.RestaurantId);
        if (restaurant == null)
            return NotFound(ApiResponse<FoodOrderDto>.Fail("Restaurant not found"));
        if (!restaurant.IsActive)
            return BadRequest(ApiResponse<FoodOrderDto>.Fail("Restaurant is currently closed"));

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

        // Auto-accept: For COD, immediately confirm valid order to Accepted. For ONLINE, keep Pending until verified payment.
        var initialOrderStatus = paymentMethod == "ONLINE" ? OrderStatus.Pending : OrderStatus.Accepted;
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
            Status = initialOrderStatus,
            CommissionRatePercent = await HotelCommissionLedgerService.ResolveCommissionRateAsync(_db, restaurant.Id),
            SubTotal = subTotal,
            DiscountAmount = 0,
            DeliveryFee = deliveryFee,
            PaymentMethod = paymentMethod,
            PaymentStatus = initialPaymentStatus,
            Notes = SanitizeNotes(request.Notes),
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

            if (_notifications != null)
            {
                try
                {
                    var kitchenUserIds = await _db.RestaurantUsers
                        .Where(ru => ru.RestaurantId == restaurant.Id && ru.IsActive)
                        .Select(ru => ru.UserId)
                        .Distinct()
                        .ToListAsync();

                    foreach (var staffUserId in kitchenUserIds)
                    {
                        await _notifications.SendPushNotificationAsync(
                            staffUserId,
                            "New Kitchen Order!",
                            $"Order #{order.OrderNumber} received from customer (₹{order.GrandTotal:F0}).",
                            "FOOD_ORDER",
                            order.OrderNumber);
                    }
                }
                catch { /* non-critical */ }
            }
        }

        return Ok(ApiResponse<FoodOrderDto>.Ok(orderDto));
    }

    /// <summary>
    /// Multi-restaurant checkout: groups cart lines by FoodItem.RestaurantId and creates N kitchen orders.
    /// ONLINE + coupon are single-restaurant only (safe). COD supports multiple hotels in one request.
    /// </summary>
    [HttpPost("checkout")]
    public async Task<ActionResult<ApiResponse<FoodCheckoutResultDto>>> Checkout([FromBody] FoodCheckoutRequest request)
    {
        if (request.Items == null || !request.Items.Any())
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("At least one food item is required"));

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<FoodCheckoutResultDto>.Fail("Authentication required"));

        var paymentMethod = (request.PaymentMethod ?? "COD").Trim().ToUpperInvariant();
        if (paymentMethod == "CASH") paymentMethod = "COD";
        if (paymentMethod != "COD" && paymentMethod != "ONLINE")
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Invalid payment method. Supported methods: COD, ONLINE"));

        if (!request.AddressId.HasValue || request.AddressId.Value <= 0)
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Delivery address is required for placing a food order"));

        var validatedAddress = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == request.AddressId.Value);
        if (validatedAddress == null)
            return NotFound(ApiResponse<FoodCheckoutResultDto>.Fail("Specified delivery address not found"));
        if (!validatedAddress.IsActive)
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Specified delivery address is inactive"));
        if (validatedAddress.UserId != userId.Value)
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<FoodCheckoutResultDto>.Fail("Unauthorized: Delivery address belongs to another customer"));
        if (string.IsNullOrWhiteSpace(validatedAddress.AddressLine1) || string.IsNullOrWhiteSpace(validatedAddress.City))
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Delivery address is incomplete (missing street line or city)"));

        if (request.Items.Count > 50)
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Cart size exceeds maximum limit of 50 items"));

        var foodIds = request.Items.Select(i => i.FoodItemId).Distinct().ToList();
        var foodRows = await _db.FoodItems
            .Include(f => f.Variants)
            .Include(f => f.Addons)
            .Include(f => f.Restaurant)
            .Where(f => foodIds.Contains(f.Id) && f.IsActive)
            .ToListAsync();

        var byId = foodRows.ToDictionary(f => f.Id);
        var groups = new Dictionary<long, List<OrderItemRequest>>();
        foreach (var line in request.Items)
        {
            if (!byId.TryGetValue(line.FoodItemId, out var food) || food.Restaurant == null || !food.Restaurant.IsActive)
                return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail($"Food item #{line.FoodItemId} not found or restaurant inactive"));
            if (!groups.TryGetValue(food.RestaurantId, out var list))
            {
                list = new List<OrderItemRequest>();
                groups[food.RestaurantId] = list;
            }
            list.Add(line);
        }

        // Single restaurant checkout with single PlaceFoodOrderRequest:
        if (groups.Count == 1)
        {
            var only = groups.First();
            var single = new PlaceFoodOrderRequest
            {
                RestaurantId = only.Key,
                AddressId = request.AddressId,
                CouponCode = request.CouponCode,
                PaymentMethod = paymentMethod,
                Notes = SanitizeNotes(request.Notes),
                Items = only.Value
            };
            var placed = await PlaceOrder(single);
            if (placed.Result is OkObjectResult ok && ok.Value is ApiResponse<FoodOrderDto> body && body.Success && body.Data != null)
            {
                PaymentOrderResult? payOrder = null;
                if (paymentMethod == "ONLINE" && _payments != null)
                {
                    var payRes = await _payments.CreatePaymentOrderAsync(body.Data.GrandTotal, "INR", body.Data.Id.ToString(), "FOOD", userId.Value);
                    if (payRes.Success) payOrder = payRes;
                }
                return Ok(ApiResponse<FoodCheckoutResultDto>.Ok(new FoodCheckoutResultDto
                {
                    Orders = new List<FoodOrderDto> { body.Data },
                    GrandTotal = body.Data.GrandTotal,
                    CheckoutGroupId = body.Data.CheckoutGroupId,
                    PaymentOrder = payOrder,
                    RestaurantCount = 1
                }));
            }
            if (placed.Result is ObjectResult err && err.Value is ApiResponse<FoodOrderDto> fail)
                return StatusCode(err.StatusCode ?? 400, ApiResponse<FoodCheckoutResultDto>.Fail(fail.Message ?? "Checkout failed"));
            return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Checkout failed"));
        }

        // Multi-restaurant fan-out: Pre-validate all kitchen groups
        var pendingCreates = new List<(Restaurant Restaurant, List<FoodOrderItem> Items, decimal SubTotal)>();
        foreach (var group in groups)
        {
            var restaurant = group.Value
                .Select(i => byId[i.FoodItemId].Restaurant!)
                .First(r => r.Id == group.Key);

            var orderItems = new List<FoodOrderItem>();
            decimal subTotal = 0;
            int totalQuantity = 0;
            foreach (var itemReq in group.Value)
            {
                if (itemReq.Quantity <= 0 || itemReq.Quantity > 30)
                    return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail($"Invalid quantity for item #{itemReq.FoodItemId}"));
                totalQuantity += itemReq.Quantity;
                if (totalQuantity > 100)
                    return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Total order item quantity exceeds maximum limit of 100"));

                var foodItem = byId[itemReq.FoodItemId];
                if (!foodItem.IsAvailable)
                    return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail($"Item '{foodItem.Name}' is currently out of stock"));

                decimal unitPrice = foodItem.DiscountedPrice;
                string? variantName = null;
                decimal variantPrice = 0;
                if (itemReq.VariantId.HasValue)
                {
                    var variant = foodItem.Variants.FirstOrDefault(v => v.Id == itemReq.VariantId.Value && v.IsActive);
                    if (variant == null)
                        return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail($"Variant #{itemReq.VariantId.Value} is invalid for '{foodItem.Name}'"));
                    variantName = variant.Name;
                    variantPrice = variant.AdditionalPrice;
                }

                var selectedAddonNames = new List<string>();
                decimal addonsTotal = 0;
                if (itemReq.SelectedAddonIds != null && itemReq.SelectedAddonIds.Any())
                {
                    var distinctAddonIds = itemReq.SelectedAddonIds.Distinct().ToList();
                    var addons = foodItem.Addons.Where(a => distinctAddonIds.Contains(a.Id) && a.IsActive).ToList();
                    if (addons.Count != distinctAddonIds.Count)
                        return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail($"Invalid add-ons for '{foodItem.Name}'"));
                    foreach (var addon in addons)
                    {
                        selectedAddonNames.Add($"{addon.Name} (+₹{addon.Price:F0})");
                        addonsTotal += addon.Price;
                    }
                }

                var lineItemPrice = (unitPrice + variantPrice + addonsTotal) * itemReq.Quantity;
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

            pendingCreates.Add((restaurant, orderItems, subTotal));
        }

        // Multi-restaurant group identifier linking all child kitchen orders
        var checkoutGroupId = $"GRP-{Guid.NewGuid():N}";
        var initialOrderStatus = paymentMethod == "ONLINE" ? OrderStatus.Pending : OrderStatus.Accepted;
        var initialPaymentStatus = paymentMethod == "ONLINE" ? "PENDING_PAYMENT" : "PENDING";

        // Proportional Coupon Allocation across restaurants:
        var totalBasket = pendingCreates.Sum(p => p.SubTotal);
        var discountsByRestaurant = new Dictionary<long, decimal>();
        long? appliedCouponId = null;

        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            var rawCoupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Code.ToUpper() == request.CouponCode.Trim().ToUpper());
            if (rawCoupon == null || !rawCoupon.IsActive)
                return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Invalid or inactive coupon code"));

            if (rawCoupon.ApplicableRestaurantId.HasValue)
            {
                // Hotel-specific coupon: must target one of the restaurants in cart and meet min order
                var targetHotel = pendingCreates.FirstOrDefault(p => p.Restaurant.Id == rawCoupon.ApplicableRestaurantId.Value);
                if (targetHotel.Restaurant == null)
                    return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail("Coupon is only valid for items from a specific restaurant not in your basket"));

                var uses = await _db.CouponUsages.CountAsync(u => u.CouponId == rawCoupon.Id && u.UserId == userId.Value);
                var quote = CouponEngine.Evaluate(rawCoupon, "FOOD", targetHotel.SubTotal, rawCoupon.ApplicableRestaurantId, uses, DateTime.UtcNow);
                if (!quote.IsValid || quote.Coupon == null)
                    return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail(quote.Message));

                appliedCouponId = quote.Coupon.Id;
                foreach (var p in pendingCreates)
                {
                    discountsByRestaurant[p.Restaurant.Id] = p.Restaurant.Id == rawCoupon.ApplicableRestaurantId.Value ? quote.DiscountAmount : 0m;
                }
            }
            else
            {
                // Global food coupon: evaluate across aggregate basket and allocate proportionally
                var uses = await _db.CouponUsages.CountAsync(u => u.CouponId == rawCoupon.Id && u.UserId == userId.Value);
                var quote = CouponEngine.Evaluate(rawCoupon, "FOOD", totalBasket, null, uses, DateTime.UtcNow);
                if (!quote.IsValid || quote.Coupon == null)
                    return BadRequest(ApiResponse<FoodCheckoutResultDto>.Fail(quote.Message));

                appliedCouponId = quote.Coupon.Id;
                var restaurantBaskets = pendingCreates.Select(p => (p.Restaurant.Id, p.SubTotal)).ToList();
                discountsByRestaurant = CouponEngine.AllocateDiscountProportionally(quote.DiscountAmount, restaurantBaskets);
            }
        }
        else
        {
            foreach (var p in pendingCreates) discountsByRestaurant[p.Restaurant.Id] = 0m;
        }

        // Fan out child kitchen orders:
        var created = new List<(FoodOrder Order, Restaurant Restaurant)>();
        foreach (var (restaurant, orderItems, subTotal) in pendingCreates)
        {
            var hotelDiscount = discountsByRestaurant.GetValueOrDefault(restaurant.Id, 0m);
            var commissionRate = await HotelCommissionLedgerService.ResolveCommissionRateAsync(_db, restaurant.Id);

            var order = new FoodOrder
            {
                OrderNumber = $"FO-{Guid.NewGuid().ToString("N")[..16]}",
                UserId = userId.Value,
                RestaurantId = restaurant.Id,
                AddressId = request.AddressId,
                CheckoutGroupId = checkoutGroupId,
                CommissionRatePercent = commissionRate,
                Status = initialOrderStatus,
                SubTotal = subTotal,
                DiscountAmount = 0,
                DeliveryFee = restaurant.DeliveryFee,
                PaymentMethod = paymentMethod,
                PaymentStatus = initialPaymentStatus,
                Notes = SanitizeNotes(request.Notes),
                EstimatedDeliveryMinutes = restaurant.AvgDeliveryTimeMinutes,
                CreatedAt = DateTime.UtcNow,
                Items = orderItems
            };

            ApplyCouponTotals(order, appliedCouponId, hotelDiscount, restaurant.DeliveryFee, subTotal);
            _db.FoodOrders.Add(order);
            created.Add((order, restaurant));
        }

        // If coupon applied, track usage
        if (appliedCouponId.HasValue)
        {
            var couponEntity = await _db.Coupons.FindAsync(appliedCouponId.Value);
            if (couponEntity != null)
            {
                couponEntity.CurrentUsageCount += 1;
                couponEntity.UpdatedAt = DateTime.UtcNow;
                _db.CouponUsages.Add(new CouponUsage
                {
                    CouponId = couponEntity.Id,
                    UserId = userId.Value,
                    UsedAt = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync();

        var ownerPhones = await ResolveRestaurantOwnerPhonesAsync(created.Select(c => c.Restaurant.Id).Distinct().ToList());
        var dtos = new List<FoodOrderDto>();
        foreach (var (order, restaurant) in created)
        {
            var dto = MapToOrderDto(order, restaurant, validatedAddress, ownerPhone: ownerPhones.GetValueOrDefault(restaurant.Id));
            dtos.Add(dto);
            // Notify hotel kitchen immediately if COD or auto-accepted
            if (paymentMethod == "COD")
            {
                try
                {
                    await _orderHub.Clients.Group($"restaurant-{restaurant.Id}").SendAsync("NewIncomingOrder", dto);
                }
                catch { /* non-critical */ }

                if (_notifications != null)
                {
                    try
                    {
                        var kitchenUserIds = await _db.RestaurantUsers
                            .Where(ru => ru.RestaurantId == restaurant.Id && ru.IsActive)
                            .Select(ru => ru.UserId)
                            .Distinct()
                            .ToListAsync();

                        foreach (var staffUserId in kitchenUserIds)
                        {
                            await _notifications.SendPushNotificationAsync(
                                staffUserId,
                                "New Kitchen Order!",
                                $"Order #{order.OrderNumber} received from customer (₹{order.GrandTotal:F0}).",
                                "FOOD_ORDER",
                                order.OrderNumber);
                        }
                    }
                    catch { /* non-critical */ }
                }
            }
        }

        var grandTotal = dtos.Sum(o => o.GrandTotal);
        PaymentOrderResult? groupPaymentOrder = null;

        // If ONLINE payment, initiate single gateway payment order for combined grand total referencing primary child order
        if (paymentMethod == "ONLINE" && _payments != null && dtos.Count > 0)
        {
            var primaryOrder = dtos[0];
            var payRes = await _payments.CreatePaymentOrderAsync(grandTotal, "INR", primaryOrder.Id.ToString(), "FOOD", userId.Value);
            if (payRes.Success) groupPaymentOrder = payRes;
        }

        return Ok(ApiResponse<FoodCheckoutResultDto>.Ok(new FoodCheckoutResultDto
        {
            Orders = dtos,
            GrandTotal = grandTotal,
            CheckoutGroupId = checkoutGroupId,
            PaymentOrder = groupPaymentOrder,
            RestaurantCount = dtos.Count
        }));
    }

    /// <summary>
    /// Consolidated group order progress and child orders for multi-restaurant checkouts
    /// </summary>
    [HttpGet("group/{groupId}")]
    public async Task<ActionResult<ApiResponse<FoodCheckoutResultDto>>> GetGroupOrders(string groupId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<FoodCheckoutResultDto>.Fail("Authentication required"));

        var orders = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.Address)
            .Include(o => o.Items)
            .Include(o => o.Driver).ThenInclude(d => d!.User)
            .Where(o => o.CheckoutGroupId == groupId && (o.UserId == userId.Value || User.IsInRole(RoleNames.Admin)))
            .OrderBy(o => o.Id)
            .ToListAsync();

        if (!orders.Any())
            return NotFound(ApiResponse<FoodCheckoutResultDto>.Fail("Order group not found"));

        var ownerPhones = await ResolveRestaurantOwnerPhonesAsync(orders.Select(o => o.RestaurantId).Distinct().ToList());
        var dtos = orders.Select(o => MapToOrderDto(o, o.Restaurant, o.Address, ownerPhone: ownerPhones.GetValueOrDefault(o.RestaurantId))).ToList();

        return Ok(ApiResponse<FoodCheckoutResultDto>.Ok(new FoodCheckoutResultDto
        {
            Orders = dtos,
            GrandTotal = dtos.Sum(o => o.GrandTotal),
            CheckoutGroupId = groupId,
            RestaurantCount = dtos.Count
        }));
    }

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
    /// Customer cancel through READY (including after captain accept). Blocked once PICKED_UP.
    /// Clears captain assignment and notifies drivers-pool.
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

        if (string.Equals(order.Status, OrderStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse.Fail("Order is already cancelled"));

        if (!FoodOrderCancellation.CanCustomerCancel(order.Status))
            return BadRequest(ApiResponse.Fail("Order cannot be cancelled after the captain has picked it up"));

        // If an online payment is already settled, initiate refund and mark order accordingly
        var nextPaymentStatus = "CANCELLED";
        if (string.Equals(order.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase))
        {
            var paidPayment = await _db.Payments
                .Where(p => p.OrderId == order.Id && p.Module == "FOOD" && p.Status == "PAID")
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            if (paidPayment != null && !string.IsNullOrWhiteSpace(paidPayment.TransactionId) && _payments != null)
            {
                var refundResult = await _payments.RefundPaymentAsync(paidPayment.TransactionId, order.GrandTotal, "Order cancelled by customer");
                nextPaymentStatus = refundResult.Success ? "REFUNDED" : "REFUND_PENDING";
            }
            else
            {
                nextPaymentStatus = "REFUND_PENDING";
            }
        }

        // Atomic claim on relational DBs: only one concurrent cancel wins (dual-cancel → one 200, one 400).
        // InMemory test provider has no ExecuteUpdate — fall back to tracked SaveChanges.
        var now = DateTime.UtcNow;
        int claimed;
        if (_db.Database.IsRelational())
        {
            claimed = await _db.FoodOrders
                .Where(o => o.Id == id && (
                    o.Status == OrderStatus.Pending
                    || o.Status == OrderStatus.Accepted
                    || o.Status == OrderStatus.Preparing
                    || o.Status == OrderStatus.Ready))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.PaymentStatus, nextPaymentStatus)
                    .SetProperty(o => o.UpdatedAt, now));

            if (claimed == 0)
                return BadRequest(ApiResponse.Fail("Order is already cancelled or can no longer be cancelled"));

            order.Status = OrderStatus.Cancelled;
            order.PaymentStatus = nextPaymentStatus;
            order.UpdatedAt = now;
        }
        else
        {
            order.Status = OrderStatus.Cancelled;
            order.PaymentStatus = nextPaymentStatus;
            order.UpdatedAt = now;
            await _db.SaveChangesAsync();
            claimed = 1;
        }

        var previousDriverId = await FoodOrderCancellation.ReleaseCaptainAndNotifyAsync(
            _db, order, _orderHub, _rideHub, cancelledBy: "customer");

        await _db.SaveChangesAsync();

        try
        {
            await FoodOrderCancellation.NotifyCancelStakeholdersAsync(
                _db, order, previousDriverId, cancelledBy: "customer", _notifications, actingUserId: userId);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FoodOrders] Cancel stakeholder notify failed for order {order.Id}: {ex.Message}");
        }

        return Ok(ApiResponse.Ok("Order cancelled successfully"));
    }

    /// <summary>
    /// Start an Razorpay (or configured gateway) session for an ONLINE food order.
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

        return Ok(ApiResponse<PaymentOrderResult>.Ok(result, "Complete payment in Razorpay. The order is paid only after verification."));
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
        Restaurant? restaurant,
        Address? address = null,
        User? user = null,
        string? ownerPhone = null)
    {
        // Prefer linked RESTAURANT_OWNER mobile when provided; otherwise restaurants.phone.
        var restPhone = !string.IsNullOrWhiteSpace(ownerPhone)
            ? ownerPhone.Trim()
            : (!string.IsNullOrWhiteSpace(restaurant?.Phone) ? restaurant.Phone : null);
        var restAddr = (restaurant != null && !string.IsNullOrWhiteSpace(restaurant.AddressLine)) 
            ? (!string.IsNullOrWhiteSpace(restaurant.City) ? $"{restaurant.AddressLine}, {restaurant.City}" : restaurant.AddressLine)
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
            CheckoutGroupId = o.CheckoutGroupId,
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

