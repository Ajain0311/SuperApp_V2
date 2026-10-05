using SuperApp.API.Models;

namespace SuperApp.API.Services;

public static class RideCompletion
{
    public static void MarkCompleted(Ride ride)
    {
        ride.Status = RideStatus.Completed;
        ride.ActualFare = ride.EstimatedFare;
        ride.CompletedAt = DateTime.UtcNow;
        ride.UpdatedAt = DateTime.UtcNow;

        var method = (ride.PaymentMethod ?? "CASH").Trim().ToUpperInvariant();
        var payment = (ride.PaymentStatus ?? string.Empty).Trim().ToUpperInvariant();
        if (method is "ONLINE" or "EASEBUZZ")
        {
            if (payment is "PAID" or "COMPLETED")
                ride.PaymentStatus = "COMPLETED";
            return;
        }

        ride.PaymentStatus = "COMPLETED";
    }
}
