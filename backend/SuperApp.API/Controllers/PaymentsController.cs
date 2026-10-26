using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentsController> _logger;
    private readonly Microsoft.AspNetCore.SignalR.IHubContext<SuperApp.API.Hubs.OrderStatusHub>? _orderHub;

    public PaymentsController(
        IPaymentService paymentService,
        AppDbContext db,
        IConfiguration configuration,
        ILogger<PaymentsController> logger,
        Microsoft.AspNetCore.SignalR.IHubContext<SuperApp.API.Hubs.OrderStatusHub>? orderHub = null)
    {
        _paymentService = paymentService;
        _db = db;
        _configuration = configuration;
        _logger = logger;
        _orderHub = orderHub;
    }

    private long? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    private (string configured, string active, string? key, bool hasCredentials, string mode) ResolveKit()
    {
        var configured = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER")
            ?? _configuration["Providers:Payment"]
            ?? "Razorpay";

        var paymentMode = Environment.GetEnvironmentVariable("PAYMENT_MODE")
            ?? _configuration["Payment:Mode"]
            ?? _configuration["Payment:Env"]
            ?? "test";

        var isTestMode = string.Equals(paymentMode, "test", StringComparison.OrdinalIgnoreCase);

        string key;
        string secret;

        if (isTestMode)
        {
            key = Environment.GetEnvironmentVariable("RAZORPAY_TEST_KEY_ID")
                ?? _configuration["Payment:Test:Key"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_ID")
                ?? Environment.GetEnvironmentVariable("PAYMENT_KEY")
                ?? _configuration["Payment:Key"]
                ?? string.Empty;

            secret = Environment.GetEnvironmentVariable("RAZORPAY_TEST_KEY_SECRET")
                ?? _configuration["Payment:Test:Secret"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_SECRET")
                ?? Environment.GetEnvironmentVariable("PAYMENT_SECRET")
                ?? _configuration["Payment:Secret"]
                ?? string.Empty;
        }
        else
        {
            key = Environment.GetEnvironmentVariable("RAZORPAY_LIVE_KEY_ID")
                ?? _configuration["Payment:Live:Key"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_ID")
                ?? Environment.GetEnvironmentVariable("PAYMENT_KEY")
                ?? _configuration["Payment:Key"]
                ?? string.Empty;

            secret = Environment.GetEnvironmentVariable("RAZORPAY_LIVE_KEY_SECRET")
                ?? _configuration["Payment:Live:Secret"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_SECRET")
                ?? Environment.GetEnvironmentVariable("PAYMENT_SECRET")
                ?? _configuration["Payment:Secret"]
                ?? string.Empty;
        }

        var hasCredentials = !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(secret);
        var useRazorpay = (string.Equals(configured, "Razorpay", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(configured, "Easebuzz", StringComparison.OrdinalIgnoreCase))
                          && hasCredentials;
        var active = useRazorpay ? "Razorpay" : "Mock";
        var mode = useRazorpay ? "razorpay" : "mock";
        return (configured, active, string.IsNullOrWhiteSpace(key) ? null : key, hasCredentials, mode);
    }

    [AllowAnonymous]
    [HttpGet("kit")]
    public ActionResult<ApiResponse<PaymentKitInfo>> GetKit()
    {
        var (configured, active, key, hasCredentials, mode) = ResolveKit();
        var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);
        return Ok(ApiResponse<PaymentKitInfo>.Ok(new PaymentKitInfo
        {
            ConfiguredProvider = configured,
            ActiveProvider = active,
            CheckoutMode = mode,
            KeyId = key,
            HasCredentials = hasCredentials,
            CheckoutUrl = isProd ? "" : "/pay-test/",
            TestCards = isProd ? [] :
            [
                "Cards, Netbanking, UPI, Wallets",
                "UPI: success@razorpay (test)"
            ]
        }));
    }

    [Authorize]
    [HttpPost("create-order")]
    public async Task<ActionResult<ApiResponse<PaymentOrderResult>>> CreateOrder([FromBody] CreatePaymentRequest request)
    {
        var authenticatedUserId = GetCurrentUserId();
        if (!authenticatedUserId.HasValue)
            return Unauthorized(ApiResponse<PaymentOrderResult>.Fail("Authentication required"));
        var userId = authenticatedUserId.Value;

        decimal authoritativeAmount = request.Amount;
        if (string.Equals(request.Module, "FOOD", StringComparison.OrdinalIgnoreCase) && long.TryParse(request.ReceiptId, out var foodOrderId))
        {
            var foodOrder = await _db.FoodOrders.FirstOrDefaultAsync(o => o.Id == foodOrderId);
            if (foodOrder == null)
            {
                return NotFound(ApiResponse<PaymentOrderResult>.Fail("Food order not found"));
            }
            if (foodOrder.UserId != userId && !User.IsInRole(RoleNames.Admin))
            {
                return Forbid();
            }
            if (string.Equals(foodOrder.Status, OrderStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiResponse<PaymentOrderResult>.Fail("Cancelled food orders cannot be paid"));
            }
            if (string.Equals(foodOrder.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(ApiResponse<PaymentOrderResult>.Fail("Food order is already paid"));
            }
            authoritativeAmount = foodOrder.GrandTotal;
        }
        else if (string.Equals(request.Module, "RIDE", StringComparison.OrdinalIgnoreCase) && long.TryParse(request.ReceiptId, out var rideId))
        {
            var ride = await _db.Rides.FirstOrDefaultAsync(r => r.Id == rideId);
            if (ride == null)
            {
                return NotFound(ApiResponse<PaymentOrderResult>.Fail("Ride not found"));
            }
            if (ride.UserId != userId && !User.IsInRole(RoleNames.Admin))
            {
                return Forbid();
            }
            if (string.Equals(ride.Status, RideStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(ApiResponse<PaymentOrderResult>.Fail("Cancelled rides cannot be paid"));
            }
            if (string.Equals(ride.PaymentStatus, "PAID", StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(ApiResponse<PaymentOrderResult>.Fail("Ride is already paid"));
            }
            authoritativeAmount = ride.ActualFare ?? ride.EstimatedFare;
        }
        else if (string.Equals(request.Module, "TEST", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(request.Module, "MARKETPLACE", StringComparison.OrdinalIgnoreCase))
        {
            if (authoritativeAmount < 1.00m) authoritativeAmount = 1.00m;
        }
        else
        {
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail("Invalid payment module or receipt ID"));
        }

        if (authoritativeAmount < 1.00m)
        {
            authoritativeAmount = 1.00m;
        }

        var result = await _paymentService.CreatePaymentOrderAsync(
            authoritativeAmount,
            request.Currency,
            request.ReceiptId,
            request.Module,
            userId);

        if (!result.Success)
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail(result.ErrorMessage ?? "Could not create payment order"));

        return Ok(ApiResponse<PaymentOrderResult>.Ok(result, "Payment order created"));
    }

    [Authorize]
    [HttpPost("verify")]
    public async Task<ActionResult<ApiResponse<PaymentVerificationResult>>> VerifyPayment([FromBody] VerifyPaymentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TransactionId) && string.IsNullOrWhiteSpace(request.OrderId))
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail("TransactionId or OrderId is required"));

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<PaymentVerificationResult>.Fail("Authentication required"));

        var payment = await _db.Payments.FirstOrDefaultAsync(p =>
            p.TransactionId == request.OrderId ||
            p.TransactionId == request.TransactionId ||
            (request.OrderId != null && p.TransactionId == request.OrderId));

        if (payment == null)
            return NotFound(ApiResponse<PaymentVerificationResult>.Fail("Payment order not found"));

        if (payment.UserId != userId.Value && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        var result = await _paymentService.VerifyPaymentAsync(
            request.TransactionId,
            request.OrderId,
            request.PaymentSignature);

        if (result.IsVerified)
        {
            await FoodPaymentSync.ApplyAsync(_db, payment.TransactionId, true, _orderHub);
            return Ok(ApiResponse<PaymentVerificationResult>.Ok(result));
        }
        else
        {
            await FoodPaymentSync.ApplyAsync(_db, payment.TransactionId, false, _orderHub);
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail(result.Message ?? "Payment verification failed"));
        }
    }

    [Authorize]
    [HttpPost("mock-complete")]
    public async Task<ActionResult<ApiResponse<PaymentVerificationResult>>> MockComplete(
        [FromBody] MockCompletePaymentRequest request)
    {
        var paymentProvider = Environment.GetEnvironmentVariable("PAYMENT_PROVIDER")
            ?? _configuration["Providers:Payment"]
            ?? "Mock";

        var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);
        if (isProd || !string.Equals(paymentProvider, "Mock", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PaymentVerificationResult>.Fail(
                "Mock payments are forbidden when PAYMENT_PROVIDER is not Mock."));
        }

        var (_, active, _, _, _) = ResolveKit();
        if (!string.Equals(active, "Mock", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<PaymentVerificationResult>.Fail(
                "Live gateway is active. Complete payment in Razorpay Checkout."));
        }

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<PaymentVerificationResult>.Fail("Authentication required"));

        if (string.IsNullOrWhiteSpace(request.TransactionId))
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail("TransactionId is required"));

        var payment = await _db.Payments.FirstOrDefaultAsync(p =>
            p.TransactionId == request.TransactionId);

        if (payment == null)
            return NotFound(ApiResponse<PaymentVerificationResult>.Fail("Payment order not found"));

        if (payment.UserId != userId.Value && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        if (string.Equals(payment.Status, "PAID", StringComparison.OrdinalIgnoreCase))
        {
            await FoodPaymentSync.ApplyAsync(_db, payment.TransactionId, true, _orderHub);
            return Ok(ApiResponse<PaymentVerificationResult>.Ok(new PaymentVerificationResult
            {
                IsVerified = true,
                TransactionId = payment.TransactionId ?? request.TransactionId,
                Status = "PAID",
                Message = "Payment already settled"
            }));
        }

        payment.Status = request.Success ? "PAID" : "FAILED";
        payment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await FoodPaymentSync.ApplyAsync(_db, payment.TransactionId, request.Success, _orderHub);

        var result = new PaymentVerificationResult
        {
            IsVerified = request.Success,
            TransactionId = payment.TransactionId ?? request.TransactionId,
            Status = payment.Status,
            Message = request.Success ? "Mock test payment successful" : "Mock test payment failed"
        };

        return Ok(ApiResponse<PaymentVerificationResult>.Ok(result));
    }

    /// <summary>Razorpay Webhook endpoint.</summary>
    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        string body;
        using (var reader = new StreamReader(Request.Body))
        {
            body = await reader.ReadToEndAsync();
        }

        var webhookSecret = Environment.GetEnvironmentVariable("RAZORPAY_WEBHOOK_SECRET")
            ?? Environment.GetEnvironmentVariable("PAYMENT_SECRET")
            ?? _configuration["Razorpay:WebhookSecret"]
            ?? _configuration["Payment:Secret"]
            ?? string.Empty;

        Request.Headers.TryGetValue("X-Razorpay-Signature", out var signatureHeader);
        var signature = signatureHeader.ToString();

        if (_paymentService is RazorpayPaymentService rzpService)
        {
            if (!rzpService.VerifyWebhookSignature(body, signature, webhookSecret))
            {
                _logger.LogWarning("Razorpay webhook signature verification failed.");
                return Unauthorized();
            }
        }

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            var root = doc.RootElement;
            var eventType = root.TryGetProperty("event", out var ev) ? ev.GetString() : "";

            if (root.TryGetProperty("payload", out var payload) &&
                payload.TryGetProperty("payment", out var paymentObj) &&
                paymentObj.TryGetProperty("entity", out var entity))
            {
                var paymentId = entity.TryGetProperty("id", out var idProp) ? idProp.GetString() : "";
                var orderId = entity.TryGetProperty("order_id", out var orderIdProp) ? orderIdProp.GetString() : "";
                var status = entity.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : "";

                if (!string.IsNullOrWhiteSpace(orderId))
                {
                    var payment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionId == orderId);
                    if (payment != null && !string.Equals(payment.Status, "PAID", StringComparison.OrdinalIgnoreCase))
                    {
                        if (eventType == "payment.captured" || string.Equals(status, "captured", StringComparison.OrdinalIgnoreCase))
                        {
                            payment.Status = "PAID";
                            payment.UpdatedAt = DateTime.UtcNow;
                            await _db.SaveChangesAsync();
                            await FoodPaymentSync.ApplyAsync(_db, orderId, true, _orderHub);
                        }
                        else if (eventType == "payment.failed" || string.Equals(status, "failed", StringComparison.OrdinalIgnoreCase))
                        {
                            payment.Status = "FAILED";
                            payment.UpdatedAt = DateTime.UtcNow;
                            await _db.SaveChangesAsync();
                            await FoodPaymentSync.ApplyAsync(_db, orderId, false, _orderHub);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Razorpay webhook payload");
        }

        return Ok(new { received = true });
    }

    [Authorize]
    [HttpGet("my-payments")]
    public async Task<ActionResult<ApiResponse<List<Payment>>>> GetMyPayments()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<List<Payment>>.Fail("Authentication required"));

        var payments = await _db.Payments
            .Where(p => p.UserId == userId.Value)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(ApiResponse<List<Payment>>.Ok(payments));
    }
}
