using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Services;

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

        long? userId = null;
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var parsed))
            userId = parsed;

        var quote = await CouponEngine.PreviewAsync(
            _db, request.Code, request.Module, request.OrderAmount, request.RestaurantId, userId);

        return Ok(ApiResponse<CouponValidationResult>.Ok(new CouponValidationResult
        {
            IsValid = quote.IsValid,
            Code = quote.Coupon?.Code,
            DiscountAmount = quote.DiscountAmount,
            FinalAmount = quote.FinalAmount,
            Message = quote.Message
        }));
    }
}
