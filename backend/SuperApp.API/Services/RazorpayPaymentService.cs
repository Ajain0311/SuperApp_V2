using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Razorpay.Api;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class RazorpayPaymentService : IPaymentService
{
    private readonly AppDbContext _db;
    private readonly ILogger<RazorpayPaymentService> _logger;
    private readonly string _key;
    private readonly string _secret;

    public RazorpayPaymentService(
        AppDbContext db,
        IConfiguration configuration,
        ILogger<RazorpayPaymentService> logger)
    {
        _db = db;
        _logger = logger;

        var mode = Environment.GetEnvironmentVariable("PAYMENT_MODE")
            ?? configuration["Payment:Mode"]
            ?? configuration["Payment:Env"]
            ?? "test";

        var isTestMode = string.Equals(mode, "test", StringComparison.OrdinalIgnoreCase);

        if (isTestMode)
        {
            _key = Environment.GetEnvironmentVariable("RAZORPAY_TEST_KEY_ID")
                ?? configuration["Payment:Test:Key"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_ID")
                ?? Environment.GetEnvironmentVariable("PAYMENT_KEY")
                ?? configuration["Payment:Key"]
                ?? string.Empty;

            _secret = Environment.GetEnvironmentVariable("RAZORPAY_TEST_KEY_SECRET")
                ?? configuration["Payment:Test:Secret"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_SECRET")
                ?? Environment.GetEnvironmentVariable("PAYMENT_SECRET")
                ?? configuration["Payment:Secret"]
                ?? string.Empty;
        }
        else
        {
            _key = Environment.GetEnvironmentVariable("RAZORPAY_LIVE_KEY_ID")
                ?? configuration["Payment:Live:Key"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_ID")
                ?? Environment.GetEnvironmentVariable("PAYMENT_KEY")
                ?? configuration["Payment:Key"]
                ?? string.Empty;

            _secret = Environment.GetEnvironmentVariable("RAZORPAY_LIVE_KEY_SECRET")
                ?? configuration["Payment:Live:Secret"]
                ?? Environment.GetEnvironmentVariable("RAZORPAY_KEY_SECRET")
                ?? Environment.GetEnvironmentVariable("PAYMENT_SECRET")
                ?? configuration["Payment:Secret"]
                ?? string.Empty;
        }
    }

    public async Task<PaymentOrderResult> CreatePaymentOrderAsync(
        decimal amount, string currency, string receiptId, string module, long userId)
    {
        if (string.IsNullOrWhiteSpace(_key) || string.IsNullOrWhiteSpace(_secret))
        {
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = "Razorpay key/secret missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
            };
        }

        // Razorpay expects amount in the smallest currency unit (paise for INR). Minimum 100 paise (₹1.00).
        var amountInPaise = (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);
        if (amountInPaise < 100)
        {
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = "Razorpay requires an amount of at least ₹1.00 (100 paise)."
            };
        }

        var normalizedCurrency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency.ToUpperInvariant();
        var normalizedReceipt = string.IsNullOrWhiteSpace(receiptId) ? $"rcpt_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}" : receiptId;
        if (normalizedReceipt.Length > 40)
        {
            normalizedReceipt = normalizedReceipt[..40];
        }

        string razorpayOrderId;
        try
        {
            var client = new RazorpayClient(_key, _secret);
            var options = new Dictionary<string, object>
            {
                { "amount", amountInPaise },
                { "currency", normalizedCurrency },
                { "receipt", normalizedReceipt },
                { "notes", new Dictionary<string, string>
                    {
                        { "module", module },
                        { "userId", userId.ToString(CultureInfo.InvariantCulture) },
                        { "receiptId", receiptId }
                    }
                }
            };

            var order = client.Order.Create(options);
            razorpayOrderId = order["id"]?.ToString() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(razorpayOrderId))
            {
                return new PaymentOrderResult
                {
                    Success = false,
                    Amount = amount,
                    Currency = normalizedCurrency,
                    ErrorMessage = "Razorpay failed to return order id."
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Razorpay CreateOrder failed for userId {UserId}, amount {Amount}", userId, amount);
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = normalizedCurrency,
                ErrorMessage = $"Razorpay order creation failed: {ex.Message}"
            };
        }

        var normalizedModule = module.ToUpperInvariant() switch
        {
            "FOOD" => "FOOD",
            "RIDE" => "RIDE",
            _ => "FOOD"
        };

        var payment = new SuperApp.API.Models.Payment
        {
            UserId = userId,
            Module = normalizedModule,
            OrderId = long.TryParse(receiptId, out var id) ? id : 0,
            Amount = amount,
            PaymentMethod = "RAZORPAY",
            TransactionId = razorpayOrderId,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        return new PaymentOrderResult
        {
            Success = true,
            OrderId = razorpayOrderId,
            TransactionId = razorpayOrderId,
            Amount = amount,
            Currency = normalizedCurrency,
            KeyId = _key,
            AccessKey = razorpayOrderId,
            PayUrl = null,
            Env = _key.StartsWith("rzp_live", StringComparison.OrdinalIgnoreCase) ? "prod" : "test"
        };
    }

    public async Task<PaymentVerificationResult> VerifyPaymentAsync(
        string transactionId, string orderId, string paymentSignature)
    {
        // For Razorpay standard web checkout:
        // transactionId is razorpay_payment_id (e.g. pay_xxxxx) or orderId
        // orderId is razorpay_order_id (e.g. order_xxxxx)
        // paymentSignature is razorpay_signature
        var effectiveOrderId = !string.IsNullOrWhiteSpace(orderId) ? orderId : transactionId;

        var payment = await _db.Payments.FirstOrDefaultAsync(p =>
            p.TransactionId == effectiveOrderId || p.TransactionId == transactionId);

        if (payment == null)
        {
            return new PaymentVerificationResult
            {
                IsVerified = false,
                TransactionId = transactionId,
                Status = "FAILED",
                Message = "Payment record not found"
            };
        }

        if (string.IsNullOrWhiteSpace(paymentSignature) || string.IsNullOrWhiteSpace(_secret))
        {
            return new PaymentVerificationResult
            {
                IsVerified = false,
                TransactionId = transactionId,
                Status = "FAILED",
                Message = "Missing signature or secret for verification"
            };
        }

        // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        var paymentId = transactionId;
        var rzpOrderId = !string.IsNullOrWhiteSpace(orderId) ? orderId : payment.TransactionId;

        var payload = $"{rzpOrderId}|{paymentId}";
        var isSignatureValid = VerifyHmacSha256(payload, paymentSignature, _secret);

        if (!isSignatureValid)
        {
            _logger.LogWarning("Razorpay signature verification failed for OrderId {OrderId}, PaymentId {PaymentId}", rzpOrderId, paymentId);
            payment.Status = "FAILED";
            payment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return new PaymentVerificationResult
            {
                IsVerified = false,
                TransactionId = paymentId,
                Status = "FAILED",
                Message = "Signature verification failed"
            };
        }

        payment.Status = "PAID";
        payment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new PaymentVerificationResult
        {
            IsVerified = true,
            TransactionId = paymentId,
            Status = "PAID",
            Message = "Payment verified successfully"
        };
    }

    public async Task<PaymentRefundResult> RefundPaymentAsync(string transactionId, decimal amount, string reason)
    {
        try
        {
            var targetPaymentId = transactionId;
            var amountInPaise = (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

            using var httpClient = new HttpClient();
            var authBytes = Encoding.ASCII.GetBytes($"{_key}:{_secret}");
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

            // If transactionId is an order ID (order_xxx), fetch the actual payment ID (pay_xxx) from Razorpay
            if (targetPaymentId.StartsWith("order_", StringComparison.OrdinalIgnoreCase))
            {
                var orderPaymentsRes = await httpClient.GetAsync($"https://api.razorpay.com/v1/orders/{targetPaymentId}/payments");
                if (orderPaymentsRes.IsSuccessStatusCode)
                {
                    var orderPaymentsJson = await orderPaymentsRes.Content.ReadAsStringAsync();
                    using var orderDoc = JsonDocument.Parse(orderPaymentsJson);
                    if (orderDoc.RootElement.TryGetProperty("items", out var items) && items.GetArrayLength() > 0)
                    {
                        var firstItem = items[0];
                        if (firstItem.TryGetProperty("id", out var idProp))
                        {
                            targetPaymentId = idProp.GetString() ?? targetPaymentId;
                        }
                    }
                }
            }

            var payload = new
            {
                amount = amountInPaise,
                notes = new Dictionary<string, string> { { "reason", reason } }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync($"https://api.razorpay.com/v1/payments/{targetPaymentId}/refund", jsonContent);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Razorpay refund HTTP {Code}: {Body}", response.StatusCode, responseBody);
                return new PaymentRefundResult
                {
                    Success = false,
                    Amount = amount,
                    ErrorMessage = responseBody
                };
            }

            using var refundDoc = JsonDocument.Parse(responseBody);
            var refundId = refundDoc.RootElement.TryGetProperty("id", out var rId) ? rId.GetString() ?? "" : "";

            return new PaymentRefundResult
            {
                Success = true,
                RefundId = refundId,
                Amount = amount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Razorpay refund failed for transaction {TransactionId}", transactionId);
            return new PaymentRefundResult
            {
                Success = false,
                Amount = amount,
                ErrorMessage = ex.Message
            };
        }
    }

    public bool VerifyWebhookSignature(string payload, string signature, string secret)
    {
        if (string.IsNullOrWhiteSpace(payload) || string.IsNullOrWhiteSpace(signature) || string.IsNullOrWhiteSpace(secret))
            return false;

        return VerifyHmacSha256(payload, signature, secret);
    }

    public static bool VerifyHmacSha256(string data, string expectedSignature, string secret)
    {
        try
        {
            var keyBytes = Encoding.UTF8.GetBytes(secret);
            var dataBytes = Encoding.UTF8.GetBytes(data);

            using var hmac = new HMACSHA256(keyBytes);
            var hashBytes = hmac.ComputeHash(dataBytes);
            var actualHex = Convert.ToHexString(hashBytes).ToLowerInvariant();

            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(actualHex),
                Encoding.UTF8.GetBytes(expectedSignature.ToLowerInvariant()));
        }
        catch
        {
            return false;
        }
    }
}
