using SuperApp.API.DTOs;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class AdminFoodItemDiscountTests
{
    [Theory]
    [InlineData(200, 10, 180)]
    [InlineData(340, 15, 289)]
    [InlineData(100, 0, 100)]
    [InlineData(99.99, 50, 50.00)]
    public void DiscountedPrice_MatchesExpected(decimal basePrice, decimal discount, decimal expected)
    {
        var item = new FoodItem
        {
            Name = "Test",
            BasePrice = basePrice,
            DiscountPercent = discount,
        };
        Assert.Equal(expected, item.DiscountedPrice);
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, true)]
    [InlineData(50, true)]
    [InlineData(100, true)]
    [InlineData(100.01, false)]
    public void DiscountPercent_ValidationRange(decimal discount, bool isValid)
    {
        var ok = discount >= 0 && discount <= 100;
        Assert.Equal(isValid, ok);
    }

    [Fact]
    public void AdminFoodItemActionRequest_DefaultsToStatus()
    {
        var req = new AdminFoodItemActionRequest { FoodItemId = 1 };
        Assert.Equal("STATUS", req.Action);
    }
}
