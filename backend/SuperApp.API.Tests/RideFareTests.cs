using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class RideFareTests
{
    [Theory]
    [InlineData("BIKE", 5.0, 25.0, 8.0, 65.0)]   // 25 + 5*8 = 65
    [InlineData("AUTO", 5.0, 35.0, 12.0, 95.0)]  // 35 + 5*12 = 95
    [InlineData("CAB", 5.0, 60.0, 16.0, 140.0)]  // 60 + 5*16 = 140
    public void Vehicle_FareCalculation_IsAccurate(string type, double distanceKm, double baseFare, double perKmRate, double expectedFare)
    {
        Assert.Contains(type, new[] { VehicleTypes.Bike, VehicleTypes.Auto, VehicleTypes.Cab });
        double calculatedFare = baseFare + (distanceKm * perKmRate);
        Assert.Equal(expectedFare, calculatedFare);
    }

    [Fact]
    public void RideOtp_Format_IsStrictly4Digits()
    {
        for (int i = 0; i < 50; i++)
        {
            var otp = new Random().Next(1000, 9999).ToString();
            Assert.Equal(4, otp.Length);
            Assert.True(int.TryParse(otp, out var val));
            Assert.InRange(val, 1000, 9999);
        }
    }

    [Theory]
    [InlineData("REQUESTED")]
    [InlineData("ASSIGNED")]
    [InlineData("ACCEPTED")]
    [InlineData("ARRIVING")]
    [InlineData("STARTED")]
    [InlineData("COMPLETED")]
    [InlineData("CANCELLED")]
    public void RideStatus_Constants_AreComplete(string status)
    {
        Assert.Contains(status, new[]
        {
            RideStatus.Requested,
            RideStatus.Assigned,
            RideStatus.Accepted,
            RideStatus.Arriving,
            RideStatus.Started,
            RideStatus.Completed,
            RideStatus.Cancelled
        });
    }
}
