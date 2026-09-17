using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

public class CreatePaymentRequest
{
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string ReceiptId { get; set; } = string.Empty;
    public string Module { get; set; } = "FOOD"; // FOOD, RIDE
}

public class VerifyPaymentRequest
{
    public string TransactionId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string PaymentSignature { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly AppDbContext _db;

    public PaymentsController(IPaymentService paymentService, AppDbContext db)
    {
        _paymentService = paymentService;
        _db = db;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1;
    }

    /// <summary>
    /// Initialize a payment order via gateway abstraction
    /// </summary>
    [HttpPost("create-order")]
    public async Task<ActionResult<ApiResponse<PaymentOrderResult>>> CreateOrder([FromBody] CreatePaymentRequest request)
    {
        if (request.Amount <= 0)
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail("Amount must be greater than zero"));

        var userId = GetCurrentUserId();
        var result = await _paymentService.CreatePaymentOrderAsync(
            request.Amount,
            request.Currency,
            request.ReceiptId,
            request.Module,
            userId);

        return Ok(ApiResponse<PaymentOrderResult>.Ok(result));
    }

    /// <summary>
    /// Verify client-side payment signature
    /// </summary>
    [HttpPost("verify")]
    public async Task<ActionResult<ApiResponse<PaymentVerificationResult>>> VerifyPayment([FromBody] VerifyPaymentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TransactionId))
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail("TransactionId is required"));

        var result = await _paymentService.VerifyPaymentAsync(request.TransactionId, request.OrderId, request.PaymentSignature);
        return Ok(ApiResponse<PaymentVerificationResult>.Ok(result));
    }

    /// <summary>
    /// Get payment history for current user
    /// </summary>
    [HttpGet("my-payments")]
    public async Task<ActionResult<ApiResponse<List<Payment>>>> GetMyPayments()
    {
        var userId = GetCurrentUserId();
        var payments = await _db.Payments
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(ApiResponse<List<Payment>>.Ok(payments));
    }
}
