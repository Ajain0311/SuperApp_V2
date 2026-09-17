namespace SuperApp.API.DTOs;

public class CreatePaymentRequest
{
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string ReceiptId { get; set; } = string.Empty;
    public string Module { get; set; } = "FOOD";
}

public class VerifyPaymentRequest
{
    public string TransactionId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string PaymentSignature { get; set; } = string.Empty;
}

public class MockCompletePaymentRequest
{
    public string TransactionId { get; set; } = string.Empty;
    public bool Success { get; set; } = true;
}

public class PaymentKitInfo
{
    public string ConfiguredProvider { get; set; } = "Mock";
    public string ActiveProvider { get; set; } = "Mock";
    public string CheckoutMode { get; set; } = "mock"; // mock | easebuzz
    public string? KeyId { get; set; }
    public bool HasCredentials { get; set; }
    public string CheckoutUrl { get; set; } = "/pay-test/";
    public string[] TestCards { get; set; } =
    [
        "4111111111111111",
        "OTP 1234",
        "success@razorpay"
    ];
}
