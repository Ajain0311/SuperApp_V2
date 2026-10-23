using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Moq;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Hubs;
using SuperApp.API.Models;
using Xunit;

namespace SuperApp.API.Tests;

public class MultiRoleTests
{
    private AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private Mock<IHubContext<OrderStatusHub>> CreateMockOrderHub()
    {
        var mockHub = new Mock<IHubContext<OrderStatusHub>>();
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockHub.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
        return mockHub;
    }

    [Fact]
    public void User_CanHoldMultipleRoles_Simultaneously()
    {
        var user = new User
        {
            Id = 100,
            MobileNumber = "6375002348",
            FullName = "Multi Role User"
        };

        var role1 = new Role { Id = 1, Name = RoleNames.Customer };
        var role2 = new Role { Id = 4, Name = RoleNames.Driver };
        var role3 = new Role { Id = 3, Name = RoleNames.RestaurantOwner };

        user.UserRoles.Add(new UserRole { UserId = 100, RoleId = 1, Role = role1 });
        user.UserRoles.Add(new UserRole { UserId = 100, RoleId = 4, Role = role2 });
        user.UserRoles.Add(new UserRole { UserId = 100, RoleId = 3, Role = role3 });

        Assert.Equal(3, user.UserRoles.Count);
        var roleNames = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        Assert.Contains(RoleNames.Customer, roleNames);
        Assert.Contains(RoleNames.Driver, roleNames);
        Assert.Contains(RoleNames.RestaurantOwner, roleNames);
    }

    [Fact]
    public async Task RestaurantOwner_WithoutAccessToOtherRestaurant_OnlySeesAssignedRestaurant()
    {
        var db = CreateContext();
        var rest1 = new Restaurant { Id = 1, Name = "Owner Restaurant", IsActive = true };
        var rest2 = new Restaurant { Id = 2, Name = "Competitor Restaurant", IsActive = true };
        db.Restaurants.AddRange(rest1, rest2);

        var user = new User { Id = 301, MobileNumber = "9900112233", FullName = "Chef Owner" };
        db.Users.Add(user);

        var ru = new RestaurantUser { Id = 1, UserId = 301, RestaurantId = 1, IsActive = true };
        db.RestaurantUsers.Add(ru);
        await db.SaveChangesAsync();

        var mockHub = CreateMockOrderHub();
        var controller = new VendorController(db, mockHub.Object);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "301"),
            new(ClaimTypes.Role, RoleNames.RestaurantOwner)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var myRestRes = await controller.GetMyRestaurant();
        var okResult = Assert.IsType<OkObjectResult>(myRestRes.Result);
        var apiRes = Assert.IsType<ApiResponse<RestaurantDetailDto>>(okResult.Value);

        Assert.Equal(1L, apiRes.Data!.Id);
        Assert.Equal("Owner Restaurant", apiRes.Data.Name);
    }

    [Fact]
    public async Task Customer_CannotAccess_VendorOperations()
    {
        var db = CreateContext();
        var rest = new Restaurant { Id = 1, Name = "Some Restaurant", IsActive = true };
        db.Restaurants.Add(rest);
        await db.SaveChangesAsync();

        var mockHub = CreateMockOrderHub();
        var controller = new VendorController(db, mockHub.Object);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "401"),
            new(ClaimTypes.Role, RoleNames.Customer) // Customer role only
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var res = await controller.GetMyRestaurant();
        // Missing restaurant mapping is authorization failure (403), not 404
        var forbid = Assert.IsType<ObjectResult>(res.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbid.StatusCode);
    }

    [Fact]
    public async Task Vendor_OrderStatusTransitions_ValidAndInvalid()
    {
        var db = CreateContext();
        var rest = new Restaurant { Id = 10, Name = "Pizza Place", IsActive = true };
        var chef = new User { Id = 501, MobileNumber = "9988776655", FullName = "Chef" };
        var ru = new RestaurantUser { Id = 10, UserId = 501, RestaurantId = 10, IsActive = true };
        var order = new FoodOrder
        {
            Id = 1001,
            OrderNumber = "ORD-TEST-1001",
            RestaurantId = 10,
            UserId = 501,
            Status = OrderStatus.Pending,
            GrandTotal = 350
        };

        db.Restaurants.Add(rest);
        db.Users.Add(chef);
        db.RestaurantUsers.Add(ru);
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();

        var mockHub = CreateMockOrderHub();
        var controller = new VendorController(db, mockHub.Object);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "501"),
            new(ClaimTypes.Role, RoleNames.RestaurantOwner)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        // Valid transition: PENDING -> ACCEPTED
        var validRes = await controller.UpdateOrderStatus(1001, new UpdateOrderStatusRequest { Status = "ACCEPTED" });
        Assert.IsType<OkObjectResult>(validRes.Result);

        var updatedOrder = await db.FoodOrders.FindAsync(1001L);
        Assert.Equal(OrderStatus.Accepted, updatedOrder!.Status);

        // Invalid transition: ACCEPTED -> DELIVERED (Must go PREPARING -> READY -> DELIVERED)
        var invalidRes = await controller.UpdateOrderStatus(1001, new UpdateOrderStatusRequest { Status = "DELIVERED" });
        Assert.IsType<BadRequestObjectResult>(invalidRes.Result);
    }

    [Fact]
    public async Task ReviewsController_SubmitReview_UpdatesAggregateRating()
    {
        var db = CreateContext();
        var rest = new Restaurant { Id = 20, Name = "Burger Joint", Rating = 0m, TotalRatings = 0, IsActive = true };
        var user = new User { Id = 601, MobileNumber = "9112233445", FullName = "Food Critic" };
        db.Restaurants.Add(rest);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new ReviewsController(db);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "601"),
            new(ClaimTypes.Role, RoleNames.Customer)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var req = new CreateReviewRequest
        {
            TargetType = "RESTAURANT",
            TargetId = 20,
            Rating = 5,
            Comment = "Delicious burgers!"
        };

        var res = await controller.SubmitReview(req);
        var okResult = Assert.IsType<OkObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse<ReviewDto>>(okResult.Value);
        Assert.True(apiRes.Success);

        var updatedRest = await db.Restaurants.FindAsync(20L);
        Assert.NotNull(updatedRest);
        Assert.Equal(1, updatedRest.TotalRatings);
        Assert.Equal(5.0m, updatedRest.Rating);
    }

    [Fact]
    public async Task Admin_CanAccess_Dashboard_AndManageUsers()
    {
        var db = CreateContext();
        var adminUser = new User { Id = 1, MobileNumber = "9999999999", FullName = "Admin User" };
        var customerUser = new User { Id = 2, MobileNumber = "9876543210", FullName = "Customer User" };
        db.Users.AddRange(adminUser, customerUser);
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "1"),
            new(ClaimTypes.Role, RoleNames.Admin),
            new(ClaimTypes.Role, RoleNames.Customer) // Dual role: Admin + Customer
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        var dashboardRes = await controller.GetDashboard();
        var okResult = Assert.IsType<OkObjectResult>(dashboardRes.Result);
        var apiRes = Assert.IsType<ApiResponse<AdminDashboardDto>>(okResult.Value);

        Assert.True(apiRes.Success);
        Assert.True(apiRes.Data!.TotalUsers >= 2);

        // Test Settings Update
        var settingRes = await controller.UpdateSetting(new UpdateSettingRequest
        {
            Key = "platform_commission_percent",
            Value = "18",
            Description = "Updated commission"
        });
        Assert.IsType<OkObjectResult>(settingRes.Result);

        var setting = await db.AppSettings.FirstOrDefaultAsync(s => s.SettingKey == "platform_commission_percent");
        Assert.NotNull(setting);
        Assert.Equal("18", setting.SettingValue);
    }

    [Fact]
    public async Task Admin_CanRemoveRole_Using_REMOVE_ROLE_Action_PreservingOtherRoles()
    {
        var db = CreateContext();
        var adminRole = new Role { Id = 1, Name = RoleNames.Admin };
        var customerRole = new Role { Id = 2, Name = RoleNames.Customer };
        var driverRole = new Role { Id = 3, Name = RoleNames.Driver };
        var ownerRole = new Role { Id = 4, Name = RoleNames.RestaurantOwner };
        db.Roles.AddRange(adminRole, customerRole, driverRole, ownerRole);

        var targetUser = new User
        {
            Id = 50,
            MobileNumber = "9876543210",
            FullName = "Multi Role User",
            IsActive = true
        };
        db.Users.Add(targetUser);
        db.UserRoles.AddRange(
            new UserRole { UserId = 50, RoleId = customerRole.Id },
            new UserRole { UserId = 50, RoleId = driverRole.Id },
            new UserRole { UserId = 50, RoleId = ownerRole.Id }
        );
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "1"),
            new(ClaimTypes.Role, RoleNames.Admin)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };

        // Act: Remove DRIVER role using explicit REMOVE_ROLE action
        var result = await controller.ManageUser(new AdminUserActionRequest
        {
            Action = "REMOVE_ROLE",
            UserId = 50,
            RoleName = "DRIVER"
        });

        // Assert
        var okRes = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse>(okRes.Value);
        Assert.True(apiRes.Success);
        Assert.Contains("Removed role DRIVER", apiRes.Message);

        // Verify database: Only DRIVER removed, Customer and RestaurantOwner remain
        var freshRoles = await db.UserRoles
            .Where(ur => ur.UserId == 50)
            .Include(ur => ur.Role)
            .Select(ur => ur.Role.Name)
            .ToListAsync();

        Assert.DoesNotContain(RoleNames.Driver, freshRoles);
        Assert.Contains(RoleNames.Customer, freshRoles);
        Assert.Contains(RoleNames.RestaurantOwner, freshRoles);
        Assert.Equal(2, freshRoles.Count);
    }

    [Fact]
    public async Task Admin_CannotRemove_CustomerRole()
    {
        var db = CreateContext();
        var customerRole = new Role { Id = 2, Name = RoleNames.Customer };
        db.Roles.Add(customerRole);

        var targetUser = new User { Id = 51, MobileNumber = "9876543211", FullName = "Customer", IsActive = true };
        db.Users.Add(targetUser);
        db.UserRoles.Add(new UserRole { UserId = 51, RoleId = customerRole.Id });
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var result = await controller.ManageUser(new AdminUserActionRequest
        {
            Action = "REMOVE_ROLE",
            UserId = 51,
            RoleName = "CUSTOMER"
        });

        var badReq = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse>(badReq.Value);
        Assert.False(apiRes.Success);
        Assert.Equal("Customer access stays on the account", apiRes.Message);
    }

    [Fact]
    public async Task Admin_ManageUser_ReturnsNotFound_ForInvalidUserId()
    {
        var db = CreateContext();
        var controller = new AdminController(db);

        var result = await controller.ManageUser(new AdminUserActionRequest
        {
            Action = "REMOVE_ROLE",
            UserId = 99999,
            RoleName = "DRIVER"
        });

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse>(notFound.Value);
        Assert.False(apiRes.Success);
        Assert.Equal("User not found", apiRes.Message);
    }

    [Fact]
    public async Task Admin_ManageUser_ReturnsBadRequest_ForNonexistentRole()
    {
        var db = CreateContext();
        var targetUser = new User { Id = 52, MobileNumber = "9876543212", FullName = "User", IsActive = true };
        db.Users.Add(targetUser);
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var result = await controller.ManageUser(new AdminUserActionRequest
        {
            Action = "REMOVE_ROLE",
            UserId = 52,
            RoleName = "NON_EXISTENT_ROLE"
        });

        var badReq = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse>(badReq.Value);
        Assert.False(apiRes.Success);
        Assert.Contains("does not exist", apiRes.Message);
    }

    [Fact]
    public async Task Admin_CannotRemove_LastAdminAccount()
    {
        var db = CreateContext();
        var adminRole = new Role { Id = 1, Name = RoleNames.Admin };
        db.Roles.Add(adminRole);

        var singleAdmin = new User { Id = 1, MobileNumber = "9999999999", FullName = "Only Admin", IsActive = true };
        db.Users.Add(singleAdmin);
        db.UserRoles.Add(new UserRole { UserId = 1, RoleId = adminRole.Id });
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var result = await controller.ManageUser(new AdminUserActionRequest
        {
            Action = "REMOVE_ROLE",
            UserId = 1,
            RoleName = "ADMIN"
        });

        var badReq = Assert.IsType<BadRequestObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse>(badReq.Value);
        Assert.False(apiRes.Success);
        Assert.Equal("Cannot remove the last active administrator account", apiRes.Message);
    }

    [Fact]
    public async Task Admin_AssignProfiles_CanResolveByMobileNumber_AndSetPassword()
    {
        var db = CreateContext();
        var adminRole = new Role { Id = 1, Name = RoleNames.Admin };
        var customerRole = new Role { Id = 2, Name = RoleNames.Customer };
        db.Roles.AddRange(adminRole, customerRole);

        var user = new User
        {
            Id = 88,
            MobileNumber = "9876543210",
            FullName = "Pending Admin",
            IsActive = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new AdminController(db);
        var result = await controller.AssignProfiles(new AdminAssignProfileRequest
        {
            MobileNumber = "9876543210",
            FullName = "Pending Admin",
            Role = "ADMIN",
            AdminPassword = "SecurePassword123!"
        });

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse<AdminUserDto>>(okResult.Value);
        Assert.True(apiRes.Success);
        Assert.Contains("ADMIN", apiRes.Data!.Roles);

        var updatedUser = await db.Users.FindAsync(88L);
        Assert.NotNull(updatedUser);
        Assert.NotNull(updatedUser.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify("SecurePassword123!", updatedUser.PasswordHash));
    }
}

