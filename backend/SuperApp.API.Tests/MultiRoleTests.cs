using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
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

        var controller = new VendorController(db);
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

        var controller = new VendorController(db);
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
        Assert.IsType<NotFoundObjectResult>(res.Result);
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
    }
}
