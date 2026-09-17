using SuperApp.API.Data;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class MockPaymentService : IPaymentService
{
    private readonly AppDbContext _db;

    public MockPaymentService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PaymentOrderResult> CreatePaymentOrderAsync(decimal amount, string currency, string receiptId, string module, long userId)
    {
        var orderId = $"order_mock_{Guid.NewGuid().ToString("N")[..12]}";
        var txnId = $"txn_{Guid.NewGuid().ToString("N")[..16]}";

        var payment = new Payment
        {
            UserId = userId,
            Module = module.ToUpperInvariant(),
            OrderId = long.TryParse(receiptId, out var id) ? id : 0,
            Amount = amount,
            PaymentMethod = "UPI",
            TransactionId = txnId,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        return new PaymentOrderResult
        {
            Success = true,
            OrderId = orderId,
            TransactionId = txnId,
            Amount = amount,
            Currency = currency,
            KeyId = "rzp_test_mock_superapp_key"
        };
    }

    public async Task<PaymentVerificationResult> VerifyPaymentAsync(string transactionId, string orderId, string paymentSignature)
    {
        var payment = _db.Payments.FirstOrDefault(p => p.TransactionId == transactionId);
        if (payment != null)
        {
            payment.Status = "PAID";
            payment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return new PaymentVerificationResult
        {
            IsVerified = true,
            TransactionId = transactionId,
            Status = "PAID",
            Message = "Mock payment verified successfully"
        };
    }

    public async Task<PaymentRefundResult> RefundPaymentAsync(string transactionId, decimal amount, string reason)
    {
        var payment = _db.Payments.FirstOrDefault(p => p.TransactionId == transactionId);
        if (payment != null)
        {
            payment.Status = "REFUNDED";
            payment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return new PaymentRefundResult
        {
            Success = true,
            RefundId = $"rfnd_{Guid.NewGuid().ToString("N")[..12]}",
            Amount = amount
        };
    }
}
