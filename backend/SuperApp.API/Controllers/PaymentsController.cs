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

    private readonly Microsoft.AspNetCore.SignalR.IHubContext<SuperApp.API.Hubs.OrderStatusHub>? _orderHub;

    public PaymentsController(
        IPaymentService paymentService,
        AppDbContext db,
        IConfiguration configuration,
        Microsoft.AspNetCore.SignalR.IHubContext<SuperApp.API.Hubs.OrderStatusHub>? orderHub = null)
    {
        _paymentService = paymentService;
        _db = db;
        _configuration = configuration;
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
            ?? "Mock";
        var key = Environment.GetEnvironmentVariable("PAYMENT_KEY")
            ?? _configuration["Payment:Key"]
            ?? string.Empty;
        var salt = Environment.GetEnvironmentVariable("PAYMENT_SECRET")
            ?? _configuration["Payment:Salt"]
            ?? _configuration["Payment:Secret"]
            ?? string.Empty;
        var hasCredentials = !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(salt);
        var useEasebuzz = string.Equals(configured, "Easebuzz", StringComparison.OrdinalIgnoreCase)
            && hasCredentials;
        var active = useEasebuzz ? "Easebuzz" : "Mock";
        var mode = useEasebuzz ? "easebuzz" : "mock";
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
            CheckoutUrl = isProd ? null : "/pay-test/",
            TestCards = isProd ? [] :
            [
                "Visa 4012 0010 3714 1112",
                "CVV any 3 digits, expiry any future date",
                "UPI success@easebuzz (test)"
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
        if (string.IsNullOrWhiteSpace(request.TransactionId))
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail("TransactionId is required"));

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<PaymentVerificationResult>.Fail("Authentication required"));

        var payment = await _db.Payments.FirstOrDefaultAsync(p =>
            p.TransactionId == request.TransactionId || p.TransactionId == request.OrderId);

        if (payment == null)
            return NotFound(ApiResponse<PaymentVerificationResult>.Fail("Payment order not found"));

        if (payment.UserId != userId.Value && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        var result = await _paymentService.VerifyPaymentAsync(
            request.TransactionId,
            request.OrderId,
            request.PaymentSignature);

        if (result.IsVerified)
            await FoodPaymentSync.ApplyAsync(_db, result.TransactionId, true, _orderHub);
        else
            await FoodPaymentSync.ApplyAsync(_db, request.TransactionId, false, _orderHub);

        return Ok(ApiResponse<PaymentVerificationResult>.Ok(result));
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
                "Live gateway is active. Complete payment in Easebuzz Checkout."));
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

    /// <summary>Easebuzz surl/furl browser return.</summary>
    [AllowAnonymous]
    [HttpGet("easebuzz-return")]
    [HttpPost("easebuzz-return")]
    public async Task<IActionResult> EasebuzzReturn()
    {
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in Request.HasFormContentType ? (IEnumerable<KeyValuePair<string, Microsoft.Extensions.Primitives.StringValues>>)Request.Form : Array.Empty<KeyValuePair<string, Microsoft.Extensions.Primitives.StringValues>>())
            fields[kv.Key] = kv.Value.ToString();
        foreach (var kv in Request.Query)
            fields[kv.Key] = kv.Value.ToString();

        fields.TryGetValue("txnid", out var txnid);
        fields.TryGetValue("status", out var status);
        txnid ??= "";
        status ??= "";

        var hashOk = false;
        if (_paymentService is EasebuzzPaymentService ease && fields.Count > 0)
            hashOk = ease.VerifyCallbackHash(fields);

        if (!string.IsNullOrWhiteSpace(txnid))
            await ApplyGatewayFieldsAsync(txnid, status, hashOk, fields);

        var paidFlag = string.Equals(status, "success", StringComparison.OrdinalIgnoreCase) ? "1" : "0";
        var html = $@"<!DOCTYPE html><html><head><meta charset='utf-8'><title>Payment</title></head>
<body style='font-family:sans-serif;background:#0A0E21;color:#fff;padding:40px'>
<h2>{(paidFlag == "1" ? "Payment successful" : "Payment closed")}</h2>
<p>txnid: {System.Net.WebUtility.HtmlEncode(txnid)}</p>
<p>status: {System.Net.WebUtility.HtmlEncode(status)}</p>
<p><a style='color:#FF6B35' href='http://localhost:8081'>Back to SuperApp</a></p>
<script>
try {{ window.opener && window.opener.postMessage({{ source:'easebuzz', txnid:'{System.Net.WebUtility.HtmlEncode(txnid)}', status:'{System.Net.WebUtility.HtmlEncode(status)}' }}, '*'); }} catch(e) {{}}
setTimeout(function(){{ window.close(); }}, 1200);
</script>
</body></html>";
        return Content(html, "text/html");
    }

    /// <summary>Easebuzz S2S webhook.</summary>
    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (Request.HasFormContentType)
        {
            foreach (var kv in Request.Form)
                fields[kv.Key] = kv.Value.ToString();
        }

        var isProd = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Production", StringComparison.OrdinalIgnoreCase);
        bool hashVerified = false;

        if (_paymentService is EasebuzzPaymentService ease)
        {
            if (!ease.VerifyCallbackHash(fields))
                return Unauthorized();
            hashVerified = true;
        }
        else if (isProd)
        {
            return Unauthorized();
        }
        else
        {
            hashVerified = true;
        }

        fields.TryGetValue("txnid", out var txnid);
        fields.TryGetValue("status", out var status);
        if (!string.IsNullOrWhiteSpace(txnid))
            await ApplyGatewayFieldsAsync(txnid, status ?? "", hashVerified, fields);

        return Ok(new { received = true });
    }

    /// <summary>
    /// Idempotent gateway apply. Success becomes PAID only when callback hash was verified
    /// and callback amount matches the stored payment amount.
    /// Unknown statuses are left unchanged.
    /// </summary>
    private async Task ApplyGatewayFieldsAsync(string txnid, string status, bool hashVerified, IDictionary<string, string>? fields = null)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionId == txnid);
        if (payment == null)
            return;
        if (string.Equals(payment.Status, "PAID", StringComparison.OrdinalIgnoreCase))
        {
            await FoodPaymentSync.ApplyAsync(_db, txnid, true, _orderHub);
            return;
        }

        var normalized = (status ?? "").Trim().ToLowerInvariant();
        if (normalized == "success")
        {
            if (!hashVerified)
                return;

            // Enforce required amount and parity on live success callback
            if (fields == null)
                return;

            if (!fields.TryGetValue("amount", out var amtStr) && !fields.TryGetValue("net_amount_debit", out amtStr))
                return; // Amount is mandatory on success callbacks

            if (string.IsNullOrWhiteSpace(amtStr) || !decimal.TryParse(amtStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var callbackAmount))
                return; // Malformed amount

            if (Math.Abs(callbackAmount - payment.Amount) > 0.01m)
                return; // Amount mismatch! Fail closed to prevent underpayment spoofing

            // Enforce currency is INR if currency field is present
            if (fields.TryGetValue("currency", out var currStr) && !string.IsNullOrWhiteSpace(currStr))
            {
                if (!string.Equals(currStr.Trim(), "INR", StringComparison.OrdinalIgnoreCase))
                    return; // Currency mismatch
            }

            payment.Status = "PAID";
        }
        else if (normalized is "usercancelled" or "user_cancelled" or "cancelled")
        {
            payment.Status = "CANCELLED";
        }
        else if (normalized is "failure" or "failed" or "dropped" or "bounced")
        {
            payment.Status = "FAILED";
        }
        else
        {
            return;
        }

        payment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await FoodPaymentSync.ApplyAsync(_db, txnid, payment.Status == "PAID", _orderHub);
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
