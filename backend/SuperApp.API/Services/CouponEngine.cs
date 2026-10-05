using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class CouponQuote
{
    public bool IsValid { get; set; }
    public string Message { get; set; } = string.Empty;
    public Coupon? Coupon { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal FinalAmount { get; set; }
}

public static class CouponEngine
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public static string NormalizeModule(string? module)
    {
        var value = (module ?? "FOOD").Trim().ToUpperInvariant();
        return value is "BAZAAR" or "MARKETPLACE" ? "MARKETPLACE" : value;
    }

    public static CouponQuote Evaluate(Coupon? coupon, string? module, decimal orderAmount, long? restaurantId, int userUseCount, DateTime now)
    {
        if (coupon == null || !coupon.IsActive)
            return Invalid("Invalid coupon code");
        if (now < coupon.StartDate || now > coupon.ExpiryDate)
            return Invalid("Coupon has expired or is not yet active");

        var requested = NormalizeModule(module);
        var allowed = NormalizeModule(coupon.ApplicableModule);
        if (allowed != "ALL" && allowed != requested)
            return Invalid($"Coupon is only valid for {coupon.ApplicableModule}");

        if (coupon.ApplicableRestaurantId.HasValue && restaurantId != coupon.ApplicableRestaurantId)
            return Invalid("Coupon is not valid for this restaurant");

        if (orderAmount < coupon.MinOrderAmount)
            return Invalid($"Minimum order amount of ₹{coupon.MinOrderAmount:F0} required for this coupon");

        if (coupon.TotalUsageLimit.HasValue && coupon.CurrentUsageCount >= coupon.TotalUsageLimit.Value)
            return Invalid("Coupon usage limit has been reached");

        if (userUseCount >= Math.Max(1, coupon.PerUserLimit))
            return Invalid("You have already used this coupon");

        var discount = DiscountFor(coupon, orderAmount);
        return new CouponQuote
        {
            IsValid = true,
            Coupon = coupon,
            DiscountAmount = discount,
            FinalAmount = Math.Max(0, orderAmount - discount),
            Message = $"Coupon applied! You saved ₹{discount:F0}"
        };
    }

    public static decimal DiscountFor(Coupon coupon, decimal orderAmount)
    {
        decimal discount;
        if (coupon.DiscountType.Equals("PERCENTAGE", StringComparison.OrdinalIgnoreCase))
        {
            discount = Math.Round(orderAmount * (coupon.DiscountValue / 100m), 2, MidpointRounding.AwayFromZero);
            if (coupon.MaxDiscount.HasValue && discount > coupon.MaxDiscount.Value)
                discount = coupon.MaxDiscount.Value;
        }
        else
        {
            discount = coupon.DiscountValue;
        }
        return Math.Min(Math.Max(0, discount), orderAmount);
    }

    public static async Task<CouponQuote> PreviewAsync(AppDbContext db, string code, string? module, decimal orderAmount, long? restaurantId, long? userId)
    {
        var coupon = await FindAsync(db, code);
        var uses = coupon == null || !userId.HasValue
            ? 0
            : await db.CouponUsages.CountAsync(u => u.CouponId == coupon.Id && u.UserId == userId.Value);
        return Evaluate(coupon, module, orderAmount, restaurantId, uses, DateTime.UtcNow);
    }

    /// <summary>
    /// Records one use only when the coupon still has remaining global and per-user capacity.
    /// </summary>
    public static async Task<CouponQuote> ConsumeAsync(AppDbContext db, string code, string? module, decimal orderAmount, long? restaurantId, long userId, long? orderId)
    {
        await Gate.WaitAsync();
        try
        {
            var coupon = await FindAsync(db, code);
            var uses = coupon == null
                ? 0
                : await db.CouponUsages.CountAsync(u => u.CouponId == coupon.Id && u.UserId == userId);
            var quote = Evaluate(coupon, module, orderAmount, restaurantId, uses, DateTime.UtcNow);
            if (!quote.IsValid || quote.Coupon == null)
                return quote;

            quote.Coupon.CurrentUsageCount += 1;
            quote.Coupon.UpdatedAt = DateTime.UtcNow;
            db.CouponUsages.Add(new CouponUsage
            {
                CouponId = quote.Coupon.Id,
                UserId = userId,
                OrderId = orderId,
                UsedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            return quote;
        }
        finally
        {
            Gate.Release();
        }
    }

    /// <summary>
    /// Stages coupon use and runs the order save under one transaction.
    /// A failure inside saveOrder rolls the usage back.
    /// </summary>
    public static async Task<CouponQuote> ConsumeForOrderAsync(
        AppDbContext db,
        string code,
        string? module,
        decimal orderAmount,
        long? restaurantId,
        long userId,
        Func<CouponQuote, Task> saveOrder)
    {
        await Gate.WaitAsync();
        Coupon? coupon = null;
        var relational = db.Database.ProviderName?.Contains("InMemory", StringComparison.OrdinalIgnoreCase) != true;
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = null;
        try
        {
            coupon = await FindAsync(db, code);
            var uses = coupon == null
                ? 0
                : await db.CouponUsages.CountAsync(u => u.CouponId == coupon.Id && u.UserId == userId);
            var quote = Evaluate(coupon, module, orderAmount, restaurantId, uses, DateTime.UtcNow);
            if (!quote.IsValid || quote.Coupon == null)
                return quote;

            if (relational)
                tx = await db.Database.BeginTransactionAsync();

            quote.Coupon.CurrentUsageCount += 1;
            quote.Coupon.UpdatedAt = DateTime.UtcNow;
            db.CouponUsages.Add(new CouponUsage
            {
                CouponId = quote.Coupon.Id,
                UserId = userId,
                UsedAt = DateTime.UtcNow
            });
            await saveOrder(quote);
            if (tx != null)
                await tx.CommitAsync();
            return quote;
        }
        catch
        {
            if (tx != null)
                await tx.RollbackAsync();
            else
                DiscardStagedCoupon(db, coupon);
            throw;
        }
        finally
        {
            if (tx != null)
                await tx.DisposeAsync();
            Gate.Release();
        }
    }

    private static void DiscardStagedCoupon(AppDbContext db, Coupon? coupon)
    {
        foreach (var entry in db.ChangeTracker.Entries<CouponUsage>().Where(e => e.State == EntityState.Added).ToList())
            entry.State = EntityState.Detached;
        if (coupon != null && db.Entry(coupon).State == EntityState.Modified)
            db.Entry(coupon).Reload();
    }

    private static async Task<Coupon?> FindAsync(AppDbContext db, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var normalized = code.Trim().ToUpperInvariant();
        return await db.Coupons.FirstOrDefaultAsync(c => c.Code.ToUpper() == normalized);
    }

    private static CouponQuote Invalid(string message) => new() { IsValid = false, Message = message };
}
