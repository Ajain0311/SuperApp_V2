using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class AdminBroadcastTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("AdminBroadcast_" + Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task Broadcast_WritesSystemNotifications_AndSkipsDuplicatePersist()
    {
        await using var db = CreateDb();
        var u1 = new User { MobileNumber = "9000001501", FullName = "A", IsActive = true, CreatedAt = DateTime.UtcNow };
        var u2 = new User { MobileNumber = "9000001502", FullName = "B", IsActive = true, CreatedAt = DateTime.UtcNow };
        var inactive = new User { MobileNumber = "9000001503", FullName = "C", IsActive = false, CreatedAt = DateTime.UtcNow };
        db.Users.AddRange(u1, u2, inactive);
        await db.SaveChangesAsync();

        var notif = new Mock<INotificationService>();
        notif
            .Setup(n => n.SendBroadcastNotificationAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()))
            .ReturnsAsync(true);

        var controller = new AdminController(db, notif.Object);
        var result = await controller.BroadcastNotification(new BroadcastNotificationRequest
        {
            Title = "Home Promo",
            Message = "See this on home",
            TargetRole = null,
        });

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(2, db.Notifications.Count());
        Assert.All(db.Notifications, n =>
        {
            Assert.Equal("SYSTEM", n.Type);
            Assert.Equal("Home Promo", n.Title);
            Assert.False(n.IsRead);
        });

        notif.Verify(
            n => n.SendBroadcastNotificationAsync("Home Promo", "See this on home", "SYSTEM", false),
            Times.Once);
    }
}
