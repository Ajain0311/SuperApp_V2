namespace SuperApp.API.Services;

public static class RideExpiryService
{
    public static readonly TimeSpan ExpiryWindow = TimeSpan.FromMinutes(5);

    public static bool IsExpired(this SuperApp.API.Models.Ride ride, DateTime? now = null)
    {
        var currentTime = now ?? DateTime.UtcNow;
        if (ride.Status == SuperApp.API.Models.RideStatus.Expired)
            return true;

        if (ride.DriverId == null &&
            (ride.Status == SuperApp.API.Models.RideStatus.Requested || ride.Status == SuperApp.API.Models.RideStatus.Searching))
        {
            return ride.CreatedAt < currentTime.Subtract(ExpiryWindow);
        }

        return false;
    }
}
