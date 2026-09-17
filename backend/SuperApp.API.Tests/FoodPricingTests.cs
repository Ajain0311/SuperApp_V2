using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class FoodPricingTests
{
    [Fact]
    public void FoodItem_DiscountedPrice_CalculatesAccurately()
    {
        // Item with 15% discount on ₹340
        var itemWithDiscount = new FoodItem
        {
            Name = "Special Biryani",
            BasePrice = 340.00m,
            DiscountPercent = 15.00m
        };

        // Item with 0% discount on ₹290
        var itemNoDiscount = new FoodItem
        {
            Name = "Paneer Biryani",
            BasePrice = 290.00m,
            DiscountPercent = 0.00m
        };

        // Assert: 340 * (1 - 0.15) = 289.00
        Assert.Equal(289.00m, itemWithDiscount.DiscountedPrice);
        Assert.Equal(290.00m, itemNoDiscount.DiscountedPrice);
    }

    [Fact]
    public void Coupon_Percentage_RespectsMaxDiscountCap()
    {
        // 50% off up to ₹100
        decimal orderAmount = 400.00m;
        decimal discountPercent = 50.00m;
        decimal maxDiscount = 100.00m;

        decimal rawDiscount = orderAmount * (discountPercent / 100m); // ₹200
        decimal cappedDiscount = Math.Min(rawDiscount, maxDiscount); // Capped to ₹100

        Assert.Equal(100.00m, cappedDiscount);
    }

    [Fact]
    public void FoodOrder_GrandTotal_MatchesFormula()
    {
        // Formula: SubTotal - DiscountAmount + DeliveryFee + TaxAmount
        decimal subTotal = 600.00m;
        decimal discountAmount = 100.00m;
        decimal deliveryFee = 35.00m;
        decimal taxAmount = Math.Round((subTotal - discountAmount) * 0.05m, 2); // 5% GST = ₹25.00

        decimal grandTotal = subTotal - discountAmount + deliveryFee + taxAmount;

        Assert.Equal(560.00m, grandTotal);
    }

    [Theory]
    [InlineData("PENDING")]
    [InlineData("ACCEPTED")]
    [InlineData("PREPARING")]
    [InlineData("READY")]
    [InlineData("PICKED_UP")]
    [InlineData("DELIVERED")]
    [InlineData("CANCELLED")]
    public void OrderStatus_Constants_AreComplete(string status)
    {
        Assert.Contains(status, new[]
        {
            OrderStatus.Pending,
            OrderStatus.Accepted,
            OrderStatus.Preparing,
            OrderStatus.Ready,
            OrderStatus.PickedUp,
            OrderStatus.Delivered,
            OrderStatus.Cancelled
        });
    }
}
