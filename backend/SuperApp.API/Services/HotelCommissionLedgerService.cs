using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public static class HotelCommissionLedgerService
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    /// <summary>
    /// Resolves the applicable commission rate percentage for a restaurant.
    /// Hierarchy: Restaurant.CommissionRatePercent -> AppSetting "platform_commission_percent" -> Default 15.00%.
    /// </summary>
    public static async Task<decimal> ResolveCommissionRateAsync(AppDbContext db, long restaurantId)
    {
        var restaurant = await db.Restaurants.AsNoTracking().FirstOrDefaultAsync(r => r.Id == restaurantId);
        if (restaurant?.CommissionRatePercent.HasValue == true && restaurant.CommissionRatePercent.Value >= 0)
        {
            return restaurant.CommissionRatePercent.Value;
        }

        var setting = await db.AppSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.SettingKey == "platform_commission_percent");
        if (setting != null && decimal.TryParse(setting.SettingValue, out var val) && val >= 0)
        {
            return val;
        }

        return 15.00m;
    }

    /// <summary>
    /// Records exactly one commission ledger entry when a food order is successfully DELIVERED.
    /// Idempotent: If an entry already exists for this food_order_id, returns the existing record without duplicating.
    /// Base: Item subtotal after hotel-level discounts, excluding tax and delivery fee.
    /// </summary>
    public static async Task<HotelCommissionLedger?> RecordDeliveryCommissionAsync(AppDbContext db, long orderId)
    {
        await Gate.WaitAsync();
        try
        {
            var existing = await db.HotelCommissionLedgers.FirstOrDefaultAsync(l => l.FoodOrderId == orderId);
            if (existing != null)
                return existing;

            var order = await db.FoodOrders
                .Include(o => o.Restaurant)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null || order.Status != OrderStatus.Delivered)
                return null;

            // Rate snapshot: use order snapshot if available, otherwise resolve current rate
            var ratePercent = order.CommissionRatePercent ?? await ResolveCommissionRateAsync(db, order.RestaurantId);
            if (!order.CommissionRatePercent.HasValue)
            {
                order.CommissionRatePercent = ratePercent;
            }

            // Food item subtotal after restaurant-level discounts
            var commissionBase = Math.Max(0, order.SubTotal - order.DiscountAmount);
            var commissionAmount = Math.Round(commissionBase * (ratePercent / 100m), 2, MidpointRounding.AwayFromZero);
            
            // CouponDiscount is platform-funded: does not reduce hotel proceeds
            var platformDiscount = order.CouponDiscount;
            var netHotelProceeds = commissionBase - commissionAmount;

            var ledger = new HotelCommissionLedger
            {
                RestaurantId = order.RestaurantId,
                FoodOrderId = order.Id,
                OrderNumber = order.OrderNumber,
                CommissionBaseAmount = commissionBase,
                CommissionRatePercent = ratePercent,
                CommissionAmount = commissionAmount,
                NetHotelProceeds = netHotelProceeds,
                PlatformFundedDiscount = platformDiscount,
                Status = "PENDING",
                CreatedAt = DateTime.UtcNow
            };

            db.HotelCommissionLedgers.Add(ledger);
            await db.SaveChangesAsync();
            return ledger;
        }
        finally
        {
            Gate.Release();
        }
    }
}
