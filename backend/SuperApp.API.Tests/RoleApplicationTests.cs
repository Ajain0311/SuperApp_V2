using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class RoleApplicationTests
{
    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("role-apps-" + Guid.NewGuid().ToString("N"))
            .Options;
        var db = new AppDbContext(options);
        db.Roles.AddRange(
            new Role { Id = 1, Name = RoleNames.Customer, IsActive = true, CreatedAt = DateTime.UtcNow },
            new Role { Id = 3, Name = RoleNames.RestaurantOwner, IsActive = true, CreatedAt = DateTime.UtcNow },
            new Role { Id = 4, Name = RoleNames.Driver, IsActive = true, CreatedAt = DateTime.UtcNow },
            new Role { Id = 5, Name = RoleNames.MarketplaceSeller, IsActive = true, CreatedAt = DateTime.UtcNow }
        );
        db.SaveChanges();
        return db;
    }

    private static async Task<(User user, AppDocument licenseDoc, AppDocument businessDoc)> SeedUserWithDocs(AppDbContext db)
    {
        var user = new User
        {
            MobileNumber = "9000000001",
            FullName = "Test Citizen",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = 1, CreatedAt = DateTime.UtcNow });
        var license = new AppDocument
        {
            DocumentNo = "DOC-LICENSE1",
            DocumentName = "license.jpg",
            BlobObject = new byte[] { 1, 2, 3 },
            OwnerUserId = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        var business = new AppDocument
        {
            DocumentNo = "DOC-BIZ1",
            DocumentName = "fssai.jpg",
            BlobObject = new byte[] { 4, 5, 6 },
            OwnerUserId = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        db.Documents.AddRange(license, business);
        await db.SaveChangesAsync();
        return (user, license, business);
    }

    [Fact]
    public async Task Submit_Driver_RequiresLicenseDocument()
    {
        await using var db = CreateDb();
        var (user, _, _) = await SeedUserWithDocs(db);
        var svc = new RoleApplicationService(db);

        var (app, err) = await svc.SubmitAsync(user.Id, new SubmitRoleApplicationRequest
        {
            RequestedRole = "DRIVER",
            LicenseNumber = "DL1234567",
            VehicleType = "BIKE",
            VehicleRegistrationNumber = "RJ14AB1234"
        });

        Assert.Null(app);
        Assert.Contains("document", err!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Approve_Driver_GrantsRoleAndCreatesVerifiedDriver()
    {
        await using var db = CreateDb();
        var (user, license, _) = await SeedUserWithDocs(db);
        var svc = new RoleApplicationService(db);

        var (submitted, submitErr) = await svc.SubmitAsync(user.Id, new SubmitRoleApplicationRequest
        {
            RequestedRole = "DRIVER",
            LicenseNumber = "DL1234567",
            LicenseDocumentNo = license.DocumentNo,
            VehicleType = "BIKE",
            VehicleRegistrationNumber = "RJ14AB1234",
            VehicleMake = "Hero",
            VehicleModel = "Splendor"
        });
        Assert.Null(submitErr);
        Assert.NotNull(submitted);
        Assert.Equal(RoleApplicationStatuses.Pending, submitted!.Status);

        var (approved, approveErr) = await svc.ApproveAsync(submitted.Id, adminId: 99, adminName: "Admin");
        Assert.Null(approveErr);
        Assert.Equal(RoleApplicationStatuses.Approved, approved!.Status);

        Assert.True(await db.UserRoles.AnyAsync(ur => ur.UserId == user.Id && ur.RoleId == 4));
        Assert.True(await db.UserRoles.AnyAsync(ur => ur.UserId == user.Id && ur.RoleId == 1)); // citizen kept
        var driver = await db.Drivers.Include(d => d.Vehicles).FirstAsync(d => d.UserId == user.Id);
        Assert.True(driver.IsVerified);
        Assert.Equal("DL1234567", driver.LicenseNumber);
        Assert.Contains(driver.Vehicles, v => v.RegistrationNumber == "RJ14AB1234");
    }

    [Fact]
    public async Task Approve_Hotel_CreatesRestaurantAndOwnerLink()
    {
        await using var db = CreateDb();
        var (user, _, biz) = await SeedUserWithDocs(db);
        var svc = new RoleApplicationService(db);

        var (submitted, submitErr) = await svc.SubmitAsync(user.Id, new SubmitRoleApplicationRequest
        {
            RequestedRole = "RESTAURANT_OWNER",
            HotelName = "Spice Hub",
            HotelAddress = "Sector 17 Market",
            HotelCity = "Chandigarh",
            HotelPhone = "9876543210",
            BusinessDocumentNo = biz.DocumentNo
        });
        Assert.Null(submitErr);

        var (approved, approveErr) = await svc.ApproveAsync(submitted!.Id, 1, "Admin");
        Assert.Null(approveErr);
        Assert.True(await db.UserRoles.AnyAsync(ur => ur.UserId == user.Id && ur.RoleId == 3));
        Assert.NotNull(approved!.ResultRestaurantId);
        Assert.True(await db.RestaurantUsers.AnyAsync(ru =>
            ru.UserId == user.Id && ru.RestaurantId == approved.ResultRestaurantId && ru.IsActive));
    }

    [Fact]
    public async Task Reject_KeepsPendingRoleUngranted()
    {
        await using var db = CreateDb();
        var (user, license, _) = await SeedUserWithDocs(db);
        var svc = new RoleApplicationService(db);
        var (submitted, _) = await svc.SubmitAsync(user.Id, new SubmitRoleApplicationRequest
        {
            RequestedRole = "DRIVER",
            LicenseNumber = "DL9999999",
            LicenseDocumentNo = license.DocumentNo,
            VehicleType = "AUTO",
            VehicleRegistrationNumber = "PB10XY9999"
        });

        var (rejected, err) = await svc.RejectAsync(submitted!.Id, 1, "Admin", "Incomplete papers");
        Assert.Null(err);
        Assert.Equal(RoleApplicationStatuses.Rejected, rejected!.Status);
        Assert.False(await db.UserRoles.AnyAsync(ur => ur.UserId == user.Id && ur.RoleId == 4));
    }
}
