using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class EasebuzzPaymentService : IPaymentService
{
    private readonly HttpClient _http;
    private readonly AppDbContext _db;
    private readonly ILogger<EasebuzzPaymentService> _logger;
    private readonly string _key;
    private readonly string _salt;
    private readonly string _env;
    private readonly string _payBase;
    private readonly string _dashboardBase;
    private readonly string _returnUrl;

    public EasebuzzPaymentService(
        HttpClient http,
        AppDbContext db,
        IConfiguration configuration,
        ILogger<EasebuzzPaymentService> logger)
    {
        _http = http;
        _db = db;
        _logger = logger;
        _key = Environment.GetEnvironmentVariable("PAYMENT_KEY")
            ?? configuration["Payment:Key"]
            ?? string.Empty;
        _salt = Environment.GetEnvironmentVariable("PAYMENT_SECRET")
            ?? configuration["Payment:Salt"]
            ?? configuration["Payment:Secret"]
            ?? string.Empty;
        _env = (Environment.GetEnvironmentVariable("PAYMENT_ENV")
            ?? configuration["Payment:Env"]
            ?? "test").ToLowerInvariant();
        var isProd = _env is "prod" or "production" or "live";
        _payBase = isProd ? "https://pay.easebuzz.in/" : "https://testpay.easebuzz.in/";
        _dashboardBase = isProd ? "https://dashboard.easebuzz.in/" : "https://testdashboard.easebuzz.in/";
        _returnUrl = Environment.GetEnvironmentVariable("PAYMENT_RETURN_URL")
            ?? configuration["Payment:ReturnUrl"]
            ?? "http://localhost:5000/api/payments/easebuzz-return";
    }

    public async Task<PaymentOrderResult> CreatePaymentOrderAsync(
        decimal amount, string currency, string receiptId, string module, long userId)
    {
        if (string.IsNullOrWhiteSpace(_key) || string.IsNullOrWhiteSpace(_salt))
        {
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = "Easebuzz key/salt missing. Set PAYMENT_KEY and PAYMENT_SECRET."
            };
        }

        if (amount < 1)
        {
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = "Easebuzz requires amount of at least ₹1."
            };
        }

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        var firstname = string.IsNullOrWhiteSpace(user?.FullName) ? "Customer" : user!.FullName!.Trim();
        var email = string.IsNullOrWhiteSpace(user?.Email) ? "test@superapp.local" : user!.Email!.Trim();
        var phone = string.IsNullOrWhiteSpace(user?.MobileNumber) ? "9999999999" : user!.MobileNumber.Trim();
        var amountStr = amount.ToString("0.00", CultureInfo.InvariantCulture);
        var txnid = $"SA{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{Random.Shared.Next(100, 999)}";
        var productinfo = string.IsNullOrWhiteSpace(module) ? "SuperApp" : module.ToUpperInvariant();

        var hash = EasebuzzHash.InitiatePayment(
            _key, txnid, amountStr, productinfo, firstname, email, "", "", "", "", "", _salt);

        var form = new Dictionary<string, string>
        {
            ["key"] = _key,
            ["txnid"] = txnid,
            ["amount"] = amountStr,
            ["productinfo"] = productinfo,
            ["firstname"] = firstname,
            ["email"] = email,
            ["phone"] = phone,
            ["surl"] = _returnUrl,
            ["furl"] = _returnUrl,
            ["hash"] = hash
        };

        using var content = new FormUrlEncodedContent(form);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded");

        HttpResponseMessage response;
        try
        {
            response = await _http.PostAsync(_payBase + "payment/initiateLink", content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Easebuzz initiate failed");
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = "Could not reach Easebuzz. Check network and try again."
            };
        }

        var body = await response.Content.ReadAsStringAsync();
        _logger.LogInformation("Easebuzz initiate {Status}: {Body}", response.StatusCode, body);

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
        }
        catch
        {
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = "Easebuzz returned a non-JSON response. Check key/salt and test environment."
            };
        }

        using (doc)
        {
        var root = doc.RootElement;
        var status = root.TryGetProperty("status", out var statusEl)
            ? statusEl.ValueKind == JsonValueKind.Number
                ? statusEl.GetInt32()
                : int.TryParse(statusEl.GetString(), out var s) ? s : 0
            : 0;
        var data = root.TryGetProperty("data", out var dataEl) ? dataEl.ToString().Trim('"') : "";

        if (status != 1 || string.IsNullOrWhiteSpace(data))
        {
            var err = root.TryGetProperty("error_desc", out var ed) ? ed.GetString() : data;
            return new PaymentOrderResult
            {
                Success = false,
                Amount = amount,
                Currency = currency,
                ErrorMessage = err ?? "Easebuzz initiate failed"
            };
        }

        var payment = new Payment
        {
            UserId = userId,
            Module = productinfo.Length > 20 ? productinfo[..20] : productinfo,
            OrderId = long.TryParse(receiptId, out var id) ? id : 0,
            Amount = amount,
            PaymentMethod = "EASEBUZZ",
            TransactionId = txnid,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        var payUrl = _payBase + "pay/" + data;
        return new PaymentOrderResult
        {
            Success = true,
            OrderId = data,
            TransactionId = txnid,
            Amount = amount,
            Currency = string.IsNullOrWhiteSpace(currency) ? "INR" : currency,
            KeyId = _key,
            AccessKey = data,
            PayUrl = payUrl,
            Env = _env is "prod" or "production" or "live" ? "prod" : "test"
        };
        }
    }

    public async Task<PaymentVerificationResult> VerifyPaymentAsync(
        string transactionId, string orderId, string paymentSignature)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p =>
            p.TransactionId == transactionId || p.TransactionId == orderId);

        if (!string.IsNullOrWhiteSpace(paymentSignature) && payment != null)
        {
            var amountStr = payment.Amount.ToString("0.00", CultureInfo.InvariantCulture);
            // Signature-only path is used after Easebuzz JS onResponse; status API is source of truth below.
        }

        var hash = EasebuzzHash.TransactionStatus(_key, transactionId, _salt);
        var form = new Dictionary<string, string>
        {
            ["key"] = _key,
            ["txnid"] = transactionId,
            ["hash"] = hash
        };
        using var content = new FormUrlEncodedContent(form);

        string body;
        try
        {
            var response = await _http.PostAsync(_dashboardBase + "transaction/v2.1/retrieve", content);
            body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode || string.IsNullOrWhiteSpace(body))
            {
                using var content2 = new FormUrlEncodedContent(form);
                var fallback = await _http.PostAsync(_dashboardBase + "transaction/v2/retrieve", content2);
                body = await fallback.Content.ReadAsStringAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Easebuzz status failed");
            return new PaymentVerificationResult
            {
                IsVerified = false,
                TransactionId = transactionId,
                Status = "UNKNOWN",
                Message = "Could not reach Easebuzz transaction API"
            };
        }

        _logger.LogInformation("Easebuzz status: {Body}", body);

        var paid = body.Contains("\"status\":\"success\"", StringComparison.OrdinalIgnoreCase)
            || body.Contains("\"txn_status\":\"success\"", StringComparison.OrdinalIgnoreCase)
            || body.Contains("\"status\": \"success\"", StringComparison.OrdinalIgnoreCase);

        if (payment != null)
        {
            payment.Status = paid ? "PAID" : "FAILED";
            payment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return new PaymentVerificationResult
        {
            IsVerified = paid,
            TransactionId = transactionId,
            Status = paid ? "PAID" : "FAILED",
            Message = paid ? "Easebuzz payment verified" : "Easebuzz payment not successful"
        };
    }

    public Task<PaymentRefundResult> RefundPaymentAsync(string transactionId, decimal amount, string reason)
    {
        return Task.FromResult(new PaymentRefundResult
        {
            Success = false,
            Amount = amount,
            ErrorMessage = "Refund not wired in this test kit"
        });
    }

    public bool VerifyCallbackHash(IDictionary<string, string> fields)
    {
        fields.TryGetValue("hash", out var incoming);
        if (string.IsNullOrWhiteSpace(incoming)) return false;

        string G(string k) => fields.TryGetValue(k, out var v) ? v ?? "" : "";
        var expected = EasebuzzHash.Reverse(
            _salt,
            G("status"),
            G("udf10"), G("udf9"), G("udf8"), G("udf7"), G("udf6"),
            G("udf5"), G("udf4"), G("udf3"), G("udf2"), G("udf1"),
            G("email"), G("firstname"), G("productinfo"), G("amount"), G("txnid"), G("key"));
        return string.Equals(incoming, expected, StringComparison.OrdinalIgnoreCase);
    }
}
