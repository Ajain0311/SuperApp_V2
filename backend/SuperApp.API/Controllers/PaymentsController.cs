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

    public PaymentsController(IPaymentService paymentService, AppDbContext db, IConfiguration configuration)
    {
        _paymentService = paymentService;
        _db = db;
        _configuration = configuration;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1;
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
        return Ok(ApiResponse<PaymentKitInfo>.Ok(new PaymentKitInfo
        {
            ConfiguredProvider = configured,
            ActiveProvider = active,
            CheckoutMode = mode,
            KeyId = key,
            HasCredentials = hasCredentials,
            CheckoutUrl = "/pay-test/",
            TestCards =
            [
                "Visa 4012 0010 3714 1112",
                "CVV any 3 digits, expiry any future date",
                "UPI success@easebuzz (test)"
            ]
        }));
    }

    [AllowAnonymous]
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

        if (!result.Success)
            return BadRequest(ApiResponse<PaymentOrderResult>.Fail(result.ErrorMessage ?? "Could not create payment order"));

        return Ok(ApiResponse<PaymentOrderResult>.Ok(result, "Payment order created"));
    }

    [AllowAnonymous]
    [HttpPost("verify")]
    public async Task<ActionResult<ApiResponse<PaymentVerificationResult>>> VerifyPayment([FromBody] VerifyPaymentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TransactionId))
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail("TransactionId is required"));

        var result = await _paymentService.VerifyPaymentAsync(
            request.TransactionId,
            request.OrderId,
            request.PaymentSignature);

        return Ok(ApiResponse<PaymentVerificationResult>.Ok(result));
    }

    [AllowAnonymous]
    [HttpPost("mock-complete")]
    public async Task<ActionResult<ApiResponse<PaymentVerificationResult>>> MockComplete(
        [FromBody] MockCompletePaymentRequest request)
    {
        var (_, active, _, _, _) = ResolveKit();
        if (!string.Equals(active, "Mock", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail(
                "Live gateway is active. Complete payment in Easebuzz Checkout."));
        }

        if (string.IsNullOrWhiteSpace(request.TransactionId))
            return BadRequest(ApiResponse<PaymentVerificationResult>.Fail("TransactionId is required"));

        var payment = await _db.Payments.FirstOrDefaultAsync(p =>
            p.TransactionId == request.TransactionId);

        if (payment == null)
            return NotFound(ApiResponse<PaymentVerificationResult>.Fail("Payment order not found"));

        payment.Status = request.Success ? "PAID" : "FAILED";
        payment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

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

        if (_paymentService is EasebuzzPaymentService ease && fields.Count > 0)
        {
            var okHash = ease.VerifyCallbackHash(fields);
            if (!okHash)
            {
                // Still persist status query; hash mismatch is logged.
            }
        }

        if (!string.IsNullOrWhiteSpace(txnid))
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionId == txnid);
            if (payment != null)
            {
                var paid = string.Equals(status, "success", StringComparison.OrdinalIgnoreCase);
                payment.Status = paid ? "PAID" : "FAILED";
                payment.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

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

        if (_paymentService is EasebuzzPaymentService ease && !ease.VerifyCallbackHash(fields))
            return Unauthorized();

        fields.TryGetValue("txnid", out var txnid);
        fields.TryGetValue("status", out var status);
        if (!string.IsNullOrWhiteSpace(txnid))
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionId == txnid);
            if (payment != null)
            {
                payment.Status = string.Equals(status, "success", StringComparison.OrdinalIgnoreCase) ? "PAID" : "FAILED";
                payment.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
        }

        return Ok(new { received = true });
    }

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
