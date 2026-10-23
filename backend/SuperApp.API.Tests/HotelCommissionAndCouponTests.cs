using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class HotelCommissionAndCouponTests
{
    private static AppDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"TestDb_{Guid.NewGuid():N}")
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void CouponEngine_AllocateDiscountProportionally_DistributesAccuratelyWithoutCentLoss()
    {
        var baskets = new List<(long RestaurantId, decimal SubTotal)>
        {
            (1L, 300.00m),
            (2L, 700.00m)
        };
        decimal totalDiscount = 100.00m;

        var allocated = CouponEngine.AllocateDiscountProportionally(totalDiscount, baskets);

        Assert.Equal(30.00m, allocated[1L]);
        Assert.Equal(70.00m, allocated[2L]);
        Assert.Equal(totalDiscount, allocated.Values.Sum());
    }

    [Fact]
    public void CouponEngine_AllocateDiscountProportionally_HandlesOddSplitsExactPenny()
    {
        var baskets = new List<(long RestaurantId, decimal SubTotal)>
        {
            (1L, 100.00m),
            (2L, 100.00m),
            (3L, 100.00m)
        };
        decimal totalDiscount = 50.00m;

        var allocated = CouponEngine.AllocateDiscountProportionally(totalDiscount, baskets);

        // 50 / 3 = 16.67, 16.67, remainder 16.66
        Assert.Equal(50.00m, allocated.Values.Sum());
    }

    [Fact]
    public void CouponEngine_Evaluate_EnforcesCapsAndExpiry()
    {
        var coupon = new Coupon
        {
            Id = 1,
            Code = "SAVE50",
            DiscountType = "PERCENTAGE",
            DiscountValue = 50,
            MinOrderAmount = 200,
            MaxDiscount = 150,
            StartDate = DateTime.UtcNow.AddDays(-1),
            ExpiryDate = DateTime.UtcNow.AddDays(10),
            IsActive = true,
            PerUserLimit = 2
        };

        // 1. Min order not met
        var quote1 = CouponEngine.Evaluate(coupon, "FOOD", 150m, null, 0, DateTime.UtcNow);
        Assert.False(quote1.IsValid);

        // 2. 50% of 500 = 250 capped at 150
        var quote2 = CouponEngine.Evaluate(coupon, "FOOD", 500m, null, 0, DateTime.UtcNow);
        Assert.True(quote2.IsValid);
        Assert.Equal(150m, quote2.DiscountAmount);

        // 3. User limit exceeded
        var quote3 = CouponEngine.Evaluate(coupon, "FOOD", 500m, null, 2, DateTime.UtcNow);
        Assert.False(quote3.IsValid);

        // 4. Expired
        var quote4 = CouponEngine.Evaluate(coupon, "FOOD", 500m, null, 0, DateTime.UtcNow.AddDays(20));
        Assert.False(quote4.IsValid);
    }

    [Fact]
    public async Task HotelCommissionLedger_RecordDeliveryCommission_IsIdempotentAndExcludesTaxAndDelivery()
    {
        using var db = CreateInMemoryDb();

        var restaurant = new Restaurant
        {
            Id = 10,
            Name = "Grand Biryani",
            IsActive = true,
            CommissionRatePercent = 18.00m // Custom override
        };
        db.Restaurants.Add(restaurant);

        var order = new FoodOrder
        {
            Id = 101,
            OrderNumber = "FO-TEST101",
            UserId = 5,
            RestaurantId = restaurant.Id,
            Status = OrderStatus.Delivered,
            SubTotal = 1000.00m,
            DiscountAmount = 100.00m, // restaurant-level discount
            CouponDiscount = 50.00m,  // platform-funded coupon discount (does NOT reduce hotel proceeds)
            DeliveryFee = 50.00m,
            TaxAmount = 45.00m,
            GrandTotal = 945.00m,
            CommissionRatePercent = 18.00m
        };
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();

        // Commission base should be subtotal - discountAmount = 1000 - 100 = 900
        // Commission amount should be 900 * 18% = 162.00
        var ledger1 = await HotelCommissionLedgerService.RecordDeliveryCommissionAsync(db, order.Id);
        Assert.NotNull(ledger1);
        Assert.Equal(900.00m, ledger1.CommissionBaseAmount);
        Assert.Equal(18.00m, ledger1.CommissionRatePercent);
        Assert.Equal(162.00m, ledger1.CommissionAmount);
        Assert.Equal("PENDING", ledger1.Status);

        // Idempotency: calling again returns existing record and does not duplicate
        var ledger2 = await HotelCommissionLedgerService.RecordDeliveryCommissionAsync(db, order.Id);
        Assert.Equal(ledger1.Id, ledger2!.Id);
        Assert.Equal(1, await db.HotelCommissionLedgers.CountAsync(l => l.FoodOrderId == order.Id));
    }
}
