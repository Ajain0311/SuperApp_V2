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
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class OrderIsolationTests
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
        mockClients.Setup(c => c.All).Returns(mockClientProxy.Object);
        return mockHub;
    }

    private Mock<IHubContext<RideTrackingHub>> CreateMockRideHub()
    {
        var mockHub = new Mock<IHubContext<RideTrackingHub>>();
        var mockClients = new Mock<IHubClients>();
        var mockClientProxy = new Mock<IClientProxy>();
        mockHub.Setup(h => h.Clients).Returns(mockClients.Object);
        mockClients.Setup(c => c.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
        mockClients.Setup(c => c.All).Returns(mockClientProxy.Object);
        return mockHub;
    }

    private void SetUserContext(ControllerBase controller, long userId, params string[] roles)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, $"User_{userId}")
        };
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var identity = new ClaimsIdentity(claims, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            }
        };
    }

    [Fact]
    public async Task CustomerA_CannotSee_CustomerB_Orders_InMyOrders_Or_GetOrder()
    {
        var db = CreateContext();
        var hub = CreateMockOrderHub();

        var customerA = new User { Id = 10, MobileNumber = "9900000010", FullName = "Customer A" };
        var customerB = new User { Id = 20, MobileNumber = "9900000020", FullName = "Customer B" };
        var restaurant = new Restaurant { Id = 1, Name = "Test Cafe", IsActive = true, Latitude = 28.0m, Longitude = 77.0m };
        var foodItem = new FoodItem { Id = 1, RestaurantId = 1, Name = "Burger", BasePrice = 120m, IsActive = true };

        var orderA = new FoodOrder
        {
            Id = 101,
            OrderNumber = "FO-101",
            UserId = customerA.Id,
            RestaurantId = restaurant.Id,
            Status = OrderStatus.Pending,
            PaymentMethod = "COD",
            PaymentStatus = "PENDING",
            GrandTotal = 120m,
            SubTotal = 120m,
            DeliveryFee = 0m
        };

        var orderB = new FoodOrder
        {
            Id = 102,
            OrderNumber = "FO-102",
            UserId = customerB.Id,
            RestaurantId = restaurant.Id,
            Status = OrderStatus.Pending,
            PaymentMethod = "COD",
            PaymentStatus = "PENDING",
            GrandTotal = 240m,
            SubTotal = 240m,
            DeliveryFee = 0m
        };

        db.Users.AddRange(customerA, customerB);
        db.Restaurants.Add(restaurant);
        db.FoodItems.Add(foodItem);
        db.FoodOrders.AddRange(orderA, orderB);
        await db.SaveChangesAsync();

        var controller = new FoodOrdersController(db, hub.Object);

        // 1. Customer A checks their own orders
        SetUserContext(controller, customerA.Id, RoleNames.Customer);
        var myOrdersRes = await controller.GetMyOrders();
        var okResult = Assert.IsType<OkObjectResult>(myOrdersRes.Result);
        var apiRes = Assert.IsType<ApiResponse<List<FoodOrderDto>>>(okResult.Value);
        Assert.Single(apiRes.Data!);
        Assert.Equal(orderA.Id, apiRes.Data![0].Id);

        // 2. Customer A tries to directly view Customer B's order -> 403 Forbidden
        var accessRes = await controller.GetOrder(orderB.Id);
        Assert.IsType<ForbidResult>(accessRes.Result);

        // 3. Customer B checks their own orders -> only sees order B
        SetUserContext(controller, customerB.Id, RoleNames.Customer);
        var bOrdersRes = await controller.GetMyOrders();
        var bOk = Assert.IsType<OkObjectResult>(bOrdersRes.Result);
        var bApiRes = Assert.IsType<ApiResponse<List<FoodOrderDto>>>(bOk.Value);
        Assert.Single(bApiRes.Data!);
        Assert.Equal(orderB.Id, bApiRes.Data![0].Id);

        // 4. Customer B tries to view Customer A's order -> 403 Forbidden
        var bAccessRes = await controller.GetOrder(orderA.Id);
        Assert.IsType<ForbidResult>(bAccessRes.Result);
    }

    [Fact]
    public async Task RestaurantOwnerA_CannotSee_OrModify_RestaurantOwnerB_Orders()
    {
        var db = CreateContext();
        var hub = CreateMockOrderHub();

        var ownerA = new User { Id = 31, MobileNumber = "9900000031", FullName = "Owner A" };
        var ownerB = new User { Id = 32, MobileNumber = "9900000032", FullName = "Owner B" };

        var restA = new Restaurant { Id = 10, Name = "Restaurant A", IsActive = true };
        var restB = new Restaurant { Id = 20, Name = "Restaurant B", IsActive = true };

        // Mappings in restaurant_users
        db.RestaurantUsers.Add(new RestaurantUser { UserId = ownerA.Id, RestaurantId = restA.Id, IsActive = true });
        db.RestaurantUsers.Add(new RestaurantUser { UserId = ownerB.Id, RestaurantId = restB.Id, IsActive = true });

        var orderA = new FoodOrder
        {
            Id = 201,
            OrderNumber = "FO-201",
            UserId = 1,
            RestaurantId = restA.Id,
            Status = OrderStatus.Pending,
            PaymentMethod = "COD",
            PaymentStatus = "PENDING",
            GrandTotal = 150m,
            SubTotal = 150m,
            DeliveryFee = 0m
        };

        var orderB = new FoodOrder
        {
            Id = 202,
            OrderNumber = "FO-202",
            UserId = 1,
            RestaurantId = restB.Id,
            Status = OrderStatus.Pending,
            PaymentMethod = "COD",
            PaymentStatus = "PENDING",
            GrandTotal = 250m,
            SubTotal = 250m,
            DeliveryFee = 0m
        };

        db.Users.AddRange(ownerA, ownerB);
        db.Restaurants.AddRange(restA, restB);
        db.FoodOrders.AddRange(orderA, orderB);
        await db.SaveChangesAsync();

        var vendorController = new VendorController(db, hub.Object);

        // 1. Owner A queries vendor orders -> only sees restA's orders
        SetUserContext(vendorController, ownerA.Id, RoleNames.RestaurantOwner);
        var ordersRes = await vendorController.GetVendorOrders(null, null);
        var okResult = Assert.IsType<OkObjectResult>(ordersRes.Result);
        var apiRes = Assert.IsType<ApiResponse<List<FoodOrderDto>>>(okResult.Value);
        Assert.Single(apiRes.Data!);
        Assert.Equal(orderA.Id, apiRes.Data![0].Id);

        // 2. Owner A attempts to modify Owner B's order -> 403 Forbid
        var updateRes = await vendorController.UpdateOrderStatus(orderB.Id, new UpdateOrderStatusRequest { Status = "ACCEPTED" });
        Assert.IsType<ForbidResult>(updateRes.Result);

        // Verify status was NOT modified
        var unchangedOrder = await db.FoodOrders.FindAsync(orderB.Id);
        Assert.Equal(OrderStatus.Pending, unchangedOrder!.Status);
    }

    [Fact]
    public async Task Admin_CanSee_AllGlobalOrders_And_Dashboard()
    {
        var db = CreateContext();
        var adminUser = new User { Id = 1, MobileNumber = "9999999999", FullName = "Global Admin" };
        var userA = new User { Id = 2, MobileNumber = "9900000002", FullName = "User 2" };
        var userB = new User { Id = 3, MobileNumber = "9900000003", FullName = "User 3" };

        var restA = new Restaurant { Id = 10, Name = "Restaurant A", IsActive = true };
        var restB = new Restaurant { Id = 20, Name = "Restaurant B", IsActive = true };

        var orderA = new FoodOrder
        {
            Id = 301,
            OrderNumber = "FO-301",
            UserId = userA.Id,
            RestaurantId = restA.Id,
            Status = OrderStatus.Delivered,
            PaymentMethod = "ONLINE",
            PaymentStatus = "PAID",
            GrandTotal = 500m,
            SubTotal = 500m,
            DeliveryFee = 0m
        };

        var orderB = new FoodOrder
        {
            Id = 302,
            OrderNumber = "FO-302",
            UserId = userB.Id,
            RestaurantId = restB.Id,
            Status = OrderStatus.Delivered,
            PaymentMethod = "COD",
            PaymentStatus = "PAID",
            GrandTotal = 300m,
            SubTotal = 300m,
            DeliveryFee = 0m
        };

        db.Users.AddRange(adminUser, userA, userB);
        db.Restaurants.AddRange(restA, restB);
        db.FoodOrders.AddRange(orderA, orderB);
        await db.SaveChangesAsync();

        var adminController = new AdminController(db);
        SetUserContext(adminController, adminUser.Id, RoleNames.Admin);

        // Admin gets food-orders: sees both
        var adminOrdersRes = await adminController.GetFoodOrders(null, null);
        var okRes = Assert.IsType<OkObjectResult>(adminOrdersRes.Result);
        var apiRes = Assert.IsType<ApiResponse<List<AdminFoodOrderDto>>>(okRes.Value);
        Assert.Equal(2, apiRes.Data!.Count);

        // Admin gets dashboard metrics: aggregate revenue calculation
        var dashboardRes = await adminController.GetDashboard();
        var dashOk = Assert.IsType<OkObjectResult>(dashboardRes.Result);
        var dashData = Assert.IsType<ApiResponse<AdminDashboardDto>>(dashOk.Value).Data!;
        Assert.Equal(800m, dashData.GrossFoodSales);
        Assert.Equal(2, dashData.TotalFoodOrders);
    }

    [Fact]
    public async Task FoodOrders_PaymentValidation_And_CodDeliveryTransition()
    {
        var db = CreateContext();
        var hub = CreateMockOrderHub();

        var customer = new User { Id = 50, MobileNumber = "9900000050", FullName = "Shopper" };
        var restaurant = new Restaurant { Id = 5, Name = "Burger Joint", IsActive = true, Latitude = 28.0m, Longitude = 77.0m };
        var item = new FoodItem { Id = 5, RestaurantId = 5, Name = "Cheese Burger", BasePrice = 200m, IsActive = true };

        db.Users.Add(customer);
        db.Restaurants.Add(restaurant);
        db.FoodItems.Add(item);
        // Map staff / owner
        db.RestaurantUsers.Add(new RestaurantUser { UserId = 51, RestaurantId = 5, IsActive = true });
        await db.SaveChangesAsync();

        var ordersController = new FoodOrdersController(db, hub.Object);
        SetUserContext(ordersController, customer.Id, RoleNames.Customer);

        // 1. Invalid payment method fails
        var invalidReq = new PlaceFoodOrderRequest
        {
            RestaurantId = 5,
            DeliveryAddress = "Flat 101, Test Street",
            PaymentMethod = "CRYPTO",
            Items = new List<OrderItemRequest> { new() { FoodItemId = 5, Quantity = 1 } }
        };
        var badRes = await ordersController.PlaceOrder(invalidReq);
        Assert.IsType<BadRequestObjectResult>(badRes.Result);

        // 2. Valid COD order sets PaymentStatus = PENDING
        var codReq = new PlaceFoodOrderRequest
        {
            RestaurantId = 5,
            DeliveryAddress = "Flat 101, Test Street",
            PaymentMethod = "COD",
            Items = new List<OrderItemRequest> { new() { FoodItemId = 5, Quantity = 1 } }
        };
        var codRes = await ordersController.PlaceOrder(codReq);
        var codOk = Assert.IsType<OkObjectResult>(codRes.Result);
        var codData = Assert.IsType<ApiResponse<FoodOrderDto>>(codOk.Value).Data!;
        Assert.Equal("COD", codData.PaymentMethod);
        Assert.Equal("PENDING", codData.PaymentStatus);

        // 3. Online order sets PaymentStatus = PENDING_PAYMENT
        var onlineReq = new PlaceFoodOrderRequest
        {
            RestaurantId = 5,
            DeliveryAddress = "Flat 101, Test Street",
            PaymentMethod = "ONLINE",
            Items = new List<OrderItemRequest> { new() { FoodItemId = 5, Quantity = 1 } }
        };
        var onlineRes = await ordersController.PlaceOrder(onlineReq);
        var onlineOk = Assert.IsType<OkObjectResult>(onlineRes.Result);
        var onlineData = Assert.IsType<ApiResponse<FoodOrderDto>>(onlineOk.Value).Data!;
        Assert.Equal("ONLINE", onlineData.PaymentMethod);
        Assert.Equal("PENDING_PAYMENT", onlineData.PaymentStatus);

        // 4. Transition COD order to DELIVERED by vendor -> automatically transitions PaymentStatus to PAID
        var vendorController = new VendorController(db, hub.Object);
        SetUserContext(vendorController, 51, RoleNames.RestaurantOwner);

        // Advance: PENDING -> ACCEPTED -> PREPARING -> READY -> PICKED_UP -> DELIVERED
        await vendorController.UpdateOrderStatus(codData.Id, new UpdateOrderStatusRequest { Status = "ACCEPTED" });
        await vendorController.UpdateOrderStatus(codData.Id, new UpdateOrderStatusRequest { Status = "PREPARING" });
        await vendorController.UpdateOrderStatus(codData.Id, new UpdateOrderStatusRequest { Status = "READY" });
        await vendorController.UpdateOrderStatus(codData.Id, new UpdateOrderStatusRequest { Status = "PICKED_UP" });
        var deliverRes = await vendorController.UpdateOrderStatus(codData.Id, new UpdateOrderStatusRequest { Status = "DELIVERED" });
        Assert.IsType<OkObjectResult>(deliverRes.Result);

        var finalizedOrder = await db.FoodOrders.FindAsync(codData.Id);
        Assert.Equal(OrderStatus.Delivered, finalizedOrder!.Status);
        Assert.Equal("PAID", finalizedOrder.PaymentStatus);
    }

    [Fact]
    public async Task Marketplace_MakeAnOffer_Lifecycle_And_Isolation()
    {
        var db = CreateContext();
        var seller = new User { Id = 61, MobileNumber = "9900000061", FullName = "Seller User" };
        var buyer = new User { Id = 62, MobileNumber = "9900000062", FullName = "Buyer User" };
        var stranger = new User { Id = 63, MobileNumber = "9900000063", FullName = "Stranger User" };

        var category = new MarketplaceCategory { Id = 1, Name = "Electronics" };
        var listing = new MarketplaceListing
        {
            Id = 1,
            UserId = seller.Id,
            CategoryId = category.Id,
            Title = "MacBook Pro M2",
            Description = "Excellent condition",
            Price = 90000m,
            Condition = "LIKE_NEW",
            Location = "Bengaluru",
            Status = ListingStatus.Active,
            IsActive = true
        };

        db.Users.AddRange(seller, buyer, stranger);
        db.MarketplaceCategories.Add(category);
        db.MarketplaceListings.Add(listing);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);

        // 1. Buyer makes an offer
        SetUserContext(controller, buyer.Id, RoleNames.Customer);
        var offerRes = await controller.MakeOffer(listing.Id, new CreateOfferRequest
        {
            OfferedPrice = 85000m,
            Message = "Can pick up today for 85k"
        });
        var offerOk = Assert.IsType<OkObjectResult>(offerRes.Result);
        var offerDto = Assert.IsType<ApiResponse<OfferDto>>(offerOk.Value).Data!;
        Assert.Equal(85000m, offerDto.OfferedPrice);
        Assert.Equal("PENDING", offerDto.Status);

        // Verify seller received a real notification
        var sellerNotification = await db.Notifications.FirstOrDefaultAsync(n => n.UserId == seller.Id && n.Type == "MARKETPLACE_OFFER");
        Assert.NotNull(sellerNotification);
        Assert.Contains("Offer", sellerNotification.Title);

        // 2. Stranger tries to accept/reject buyer's offer -> 403 Forbidden
        SetUserContext(controller, stranger.Id, RoleNames.Customer);
        var strangerRes = await controller.UpdateOfferStatus(offerDto.Id, new UpdateOfferStatusRequest { Status = "ACCEPTED" });
        Assert.IsType<ForbidResult>(strangerRes.Result);

        // 3. Seller accepts the offer
        SetUserContext(controller, seller.Id, RoleNames.Customer);
        var acceptRes = await controller.UpdateOfferStatus(offerDto.Id, new UpdateOfferStatusRequest { Status = "ACCEPTED" });
        var acceptOk = Assert.IsType<OkObjectResult>(acceptRes.Result);
        var acceptedDto = Assert.IsType<ApiResponse<OfferDto>>(acceptOk.Value).Data!;
        Assert.Equal("ACCEPTED", acceptedDto.Status);

        // Verify buyer received acceptance notification
        var buyerNotification = await db.Notifications.FirstOrDefaultAsync(n => n.UserId == buyer.Id && n.Type == "MARKETPLACE_OFFER");
        Assert.NotNull(buyerNotification);
        Assert.Contains("Accepted", buyerNotification.Title);
    }

    [Fact]
    public async Task Ride_DataIsolation_And_AccessControl()
    {
        var db = CreateContext();
        var rideHub = CreateMockRideHub();
        var mapMock = new Mock<IMapService>();
        mapMock.Setup(m => m.EstimateRouteAsync(It.IsAny<decimal>(), It.IsAny<decimal>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .ReturnsAsync(new RouteEstimationResult { DistanceKm = 10.0, EstimatedDurationMinutes = 20 });

        var riderA = new User { Id = 71, MobileNumber = "9900000071", FullName = "Rider A" };
        var riderB = new User { Id = 72, MobileNumber = "9900000072", FullName = "Rider B" };

        var rideA = new Ride
        {
            Id = 501,
            RideNumber = "RD-501",
            UserId = riderA.Id,
            VehicleType = "CAB",
            PickupAddress = "Location A",
            DropoffAddress = "Location B",
            DistanceKm = 10m,
            EstimatedFare = 150m,
            Status = RideStatus.Requested,
            OtpCode = "1234"
        };

        db.Users.AddRange(riderA, riderB);
        db.Rides.Add(rideA);
        await db.SaveChangesAsync();

        var controller = new RidesController(db, rideHub.Object, mapMock.Object);

        // 1. Rider A sees their ride in GetMyRides
        SetUserContext(controller, riderA.Id, RoleNames.Customer);
        var myRidesRes = await controller.GetMyRides();
        var myOk = Assert.IsType<OkObjectResult>(myRidesRes.Result);
        var myData = Assert.IsType<ApiResponse<List<RideDto>>>(myOk.Value).Data!;
        Assert.Single(myData);

        // 2. Rider B calling GetMyRides does not see Rider A's ride
        SetUserContext(controller, riderB.Id, RoleNames.Customer);
        var bRidesRes = await controller.GetMyRides();
        var bOk = Assert.IsType<OkObjectResult>(bRidesRes.Result);
        var bData = Assert.IsType<ApiResponse<List<RideDto>>>(bOk.Value).Data!;
        Assert.Empty(bData);

        // 3. Rider B trying to access Rider A's ride directly -> 403 Forbidden
        var bDirectRes = await controller.GetRide(rideA.Id);
        Assert.IsType<ForbidResult>(bDirectRes.Result);
    }
}
