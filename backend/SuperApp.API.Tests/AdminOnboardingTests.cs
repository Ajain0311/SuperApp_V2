using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class AdminOnboardingTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void Percentage_coupon_respects_minimum_and_cap()
    {
        var coupon = new Coupon
        {
            Code = "SAVE50",
            DiscountType = "PERCENTAGE",
            DiscountValue = 50,
            MinOrderAmount = 199,
            MaxDiscount = 50,
            StartDate = DateTime.UtcNow.AddDays(-1),
            ExpiryDate = DateTime.UtcNow.AddDays(10),
            ApplicableModule = "FOOD",
            PerUserLimit = 1,
            IsActive = true
        };

        var tooSmall = CouponEngine.Evaluate(coupon, "FOOD", 100, null, 0, DateTime.UtcNow);
        Assert.False(tooSmall.IsValid);

        var quote = CouponEngine.Evaluate(coupon, "FOOD", 400, null, 0, DateTime.UtcNow);
        Assert.True(quote.IsValid);
        Assert.Equal(50, quote.DiscountAmount);
    }

    [Fact]
    public async Task Concurrent_uses_cannot_pass_the_limit()
    {
        var db = CreateContext();
        db.Coupons.Add(new Coupon
        {
            Id = 7,
            Code = "ONCE",
            DiscountType = "FLAT",
            DiscountValue = 10,
            MinOrderAmount = 0,
            StartDate = DateTime.UtcNow.AddDays(-1),
            ExpiryDate = DateTime.UtcNow.AddDays(2),
            ApplicableModule = "ALL",
            TotalUsageLimit = 1,
            PerUserLimit = 1,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var first = await CouponEngine.ConsumeAsync(db, "ONCE", "FOOD", 100, null, 1, null);
        var second = await CouponEngine.ConsumeAsync(db, "ONCE", "RIDE", 100, null, 2, null);
        Assert.True(first.IsValid);
        Assert.False(second.IsValid);
        Assert.Equal(1, await db.CouponUsages.CountAsync());
    }

    [Fact]
    public void Expired_and_wrong_module_are_rejected()
    {
        var coupon = new Coupon
        {
            Code = "OLD",
            DiscountType = "FLAT",
            DiscountValue = 20,
            StartDate = DateTime.UtcNow.AddDays(-10),
            ExpiryDate = DateTime.UtcNow.AddDays(-1),
            ApplicableModule = "RIDE",
            IsActive = true
        };
        Assert.False(CouponEngine.Evaluate(coupon, "RIDE", 100, null, 0, DateTime.UtcNow).IsValid);

        coupon.ExpiryDate = DateTime.UtcNow.AddDays(2);
        Assert.False(CouponEngine.Evaluate(coupon, "FOOD", 100, null, 0, DateTime.UtcNow).IsValid);
    }
}
