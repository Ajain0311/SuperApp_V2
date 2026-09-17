using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CouponsController : ControllerBase
{
    private readonly AppDbContext _db;

    public CouponsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Backend coupon validation and calculation engine
    /// </summary>
    [HttpPost("validate")]
    public async Task<ActionResult<ApiResponse<CouponValidationResult>>> ValidateCoupon([FromBody] ValidateCouponRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(ApiResponse<CouponValidationResult>.Fail("Coupon code is required"));

        var coupon = await _db.Coupons.FirstOrDefaultAsync(c =>
            c.Code.ToUpper() == request.Code.Trim().ToUpper() && c.IsActive);

        if (coupon == null)
        {
            return Ok(ApiResponse<CouponValidationResult>.Ok(new CouponValidationResult
            {
                IsValid = false,
                Message = "Invalid coupon code"
            }));
        }

        var now = DateTime.UtcNow;
        if (now < coupon.StartDate || now > coupon.ExpiryDate)
        {
            return Ok(ApiResponse<CouponValidationResult>.Ok(new CouponValidationResult
            {
                IsValid = false,
                Message = "Coupon has expired or is not yet active"
            }));
        }

        if (coupon.ApplicableModule != "ALL" && !coupon.ApplicableModule.Equals(request.Module, StringComparison.OrdinalIgnoreCase))
        {
            return Ok(ApiResponse<CouponValidationResult>.Ok(new CouponValidationResult
            {
                IsValid = false,
                Message = $"Coupon is only valid for {coupon.ApplicableModule} service"
            }));
        }

        if (request.OrderAmount < coupon.MinOrderAmount)
        {
            return Ok(ApiResponse<CouponValidationResult>.Ok(new CouponValidationResult
            {
                IsValid = false,
                Message = $"Minimum order amount of ₹{coupon.MinOrderAmount:F0} required for this coupon"
            }));
        }

        decimal discount = 0;
        if (coupon.DiscountType.Equals("PERCENTAGE", StringComparison.OrdinalIgnoreCase))
        {
            discount = Math.Round(request.OrderAmount * (coupon.DiscountValue / 100m), 2);
            if (coupon.MaxDiscount.HasValue && discount > coupon.MaxDiscount.Value)
            {
                discount = coupon.MaxDiscount.Value;
            }
        }
        else
        {
            discount = coupon.DiscountValue;
        }

        discount = Math.Min(discount, request.OrderAmount);
        var finalAmount = request.OrderAmount - discount;

        return Ok(ApiResponse<CouponValidationResult>.Ok(new CouponValidationResult
        {
            IsValid = true,
            Code = coupon.Code,
            DiscountAmount = discount,
            FinalAmount = finalAmount,
            Message = $"Coupon applied! You saved ₹{discount:F0}"
        }));
    }
}
