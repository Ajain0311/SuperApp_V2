namespace SuperApp.API.Services;

public class PaymentOrderResult
{
    public bool Success { get; set; }
    public string OrderId { get; set; } = string.Empty;
    public string TransactionId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? KeyId { get; set; }
    public string? AccessKey { get; set; }
    public string? PayUrl { get; set; }
    public string? Env { get; set; }
    public string? ErrorMessage { get; set; }
}

public class PaymentVerificationResult
{
    public bool IsVerified { get; set; }
    public string TransactionId { get; set; } = string.Empty;
    public string Status { get; set; } = "SUCCESS";
    public string? Message { get; set; }
}

public class PaymentRefundResult
{
    public bool Success { get; set; }
    public string RefundId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? ErrorMessage { get; set; }
}

public interface IPaymentService
{
    Task<PaymentOrderResult> CreatePaymentOrderAsync(decimal amount, string currency, string receiptId, string module, long userId);
    Task<PaymentVerificationResult> VerifyPaymentAsync(string transactionId, string orderId, string paymentSignature);
    Task<PaymentRefundResult> RefundPaymentAsync(string transactionId, decimal amount, string reason);
}
