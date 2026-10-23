using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;

namespace SuperApp.API.Tests;

public class MarketplaceChatTests
{
    private AppDbContext GetInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private void SetUserContext(ControllerBase controller, long userId, string role = RoleNames.Customer)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            }
        };
    }

    [Fact]
    public async Task OpenChat_WhenBuyerAndSellerAreDistinct_CreatesOrRetrievesConversation()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var buyer = new User { Id = 20, FullName = "Buyer User", MobileNumber = "9876543211" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "MacBook Pro M2",
            Price = 120000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        db.Users.AddRange(seller, buyer);
        db.MarketplaceListings.Add(listing);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUserContext(controller, buyer.Id);

        // 1. Buyer opens chat
        var res = await controller.OpenChat(listing.Id);
        var okRes = Assert.IsType<OkObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse<ChatConversationDto>>(okRes.Value);
        Assert.True(apiRes.Success);
        Assert.Equal(buyer.Id, apiRes.Data!.BuyerId);
        Assert.Equal(seller.Id, apiRes.Data.SellerId);
        Assert.Equal(listing.Id, apiRes.Data.ListingId);

        var convId = apiRes.Data.Id;

        // 2. Open chat again retrieves same conversation without duplicate creation
        var res2 = await controller.OpenChat(listing.Id);
        var okRes2 = Assert.IsType<OkObjectResult>(res2.Result);
        var apiRes2 = Assert.IsType<ApiResponse<ChatConversationDto>>(okRes2.Value);
        Assert.Equal(convId, apiRes2.Data!.Id);
    }

    [Fact]
    public async Task OpenChat_WhenSellerTriesToChatWithSelf_ReturnsBadRequest()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "MacBook Pro M2",
            Price = 120000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        db.Users.Add(seller);
        db.MarketplaceListings.Add(listing);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUserContext(controller, seller.Id);

        var res = await controller.OpenChat(listing.Id);
        var badReq = Assert.IsType<BadRequestObjectResult>(res.Result);
        var apiRes = Assert.IsType<ApiResponse<ChatConversationDto>>(badReq.Value);
        Assert.False(apiRes.Success);
        Assert.Contains("yourself", apiRes.Message);
    }

    [Fact]
    public async Task SendMessage_PersistsMessageAndReturnsDto()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var buyer = new User { Id = 20, FullName = "Buyer User", MobileNumber = "9876543211" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "MacBook Pro M2",
            Price = 120000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        var conv = new ChatConversation
        {
            Id = 50,
            ListingId = listing.Id,
            BuyerId = buyer.Id,
            SellerId = seller.Id
        };
        db.Users.AddRange(seller, buyer);
        db.MarketplaceListings.Add(listing);
        db.ChatConversations.Add(conv);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUserContext(controller, buyer.Id);

        var msgRes = await controller.SendMessage(conv.Id, new SendChatMessageRequest
        {
            MessageText = "Is this still available?"
        });

        var okRes = Assert.IsType<OkObjectResult>(msgRes.Result);
        var apiRes = Assert.IsType<ApiResponse<ChatMessageDto>>(okRes.Value);
        Assert.True(apiRes.Success);
        Assert.Equal("Is this still available?", apiRes.Data!.MessageText);
        Assert.Equal(buyer.Id, apiRes.Data.SenderId);
        Assert.Equal("Buyer User", apiRes.Data.SenderName);

        // Verify database persistence
        var dbMessages = await db.ChatMessages.Where(m => m.ConversationId == conv.Id).ToListAsync();
        Assert.Single(dbMessages);
        Assert.Equal("Is this still available?", dbMessages[0].MessageText);
    }

    [Fact]
    public async Task UnauthorizedUser_CannotAccessOrSendMessageInOthersConversation()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var buyer = new User { Id = 20, FullName = "Buyer User", MobileNumber = "9876543211" };
        var intruder = new User { Id = 99, FullName = "Intruder User", MobileNumber = "9876543299" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "MacBook Pro M2",
            Price = 120000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        var conv = new ChatConversation
        {
            Id = 50,
            ListingId = listing.Id,
            BuyerId = buyer.Id,
            SellerId = seller.Id
        };
        db.Users.AddRange(seller, buyer, intruder);
        db.MarketplaceListings.Add(listing);
        db.ChatConversations.Add(conv);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUserContext(controller, intruder.Id);

        // Intruder tries to get conversation
        var getRes = await controller.GetConversation(conv.Id);
        Assert.IsType<ForbidResult>(getRes.Result);

        // Intruder tries to send message
        var sendRes = await controller.SendMessage(conv.Id, new SendChatMessageRequest { MessageText = "Spying" });
        Assert.IsType<ForbidResult>(sendRes.Result);
    }

    [Fact]
    public async Task SendMessage_DuplicateRapidRetry_IsIdempotentAndDoesNotCreateSecondMessage()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var buyer = new User { Id = 20, FullName = "Buyer User", MobileNumber = "9876543211" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "iPhone 15",
            Price = 75000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        var conv = new ChatConversation
        {
            Id = 50,
            ListingId = listing.Id,
            BuyerId = buyer.Id,
            SellerId = seller.Id
        };
        db.Users.AddRange(seller, buyer);
        db.MarketplaceListings.Add(listing);
        db.ChatConversations.Add(conv);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUserContext(controller, buyer.Id);

        var req = new SendChatMessageRequest
        {
            MessageText = "Hello, is price negotiable?",
            ClientMessageId = "cmsg-test-123"
        };

        // First send
        var res1 = await controller.SendMessage(conv.Id, req);
        var ok1 = Assert.IsType<OkObjectResult>(res1.Result);
        var api1 = Assert.IsType<ApiResponse<ChatMessageDto>>(ok1.Value);
        Assert.True(api1.Success);

        // Immediate retry (same ClientMessageId) must be idempotent
        var res2 = await controller.SendMessage(conv.Id, req);
        var ok2 = Assert.IsType<OkObjectResult>(res2.Result);
        var api2 = Assert.IsType<ApiResponse<ChatMessageDto>>(ok2.Value);
        Assert.True(api2.Success);

        // Assert same message ID returned
        Assert.Equal(api1.Data!.Id, api2.Data!.Id);

        // Verify only 1 row was stored in DB
        var totalMessages = await db.ChatMessages.Where(m => m.ConversationId == conv.Id).CountAsync();
        Assert.Equal(1, totalMessages);
    }

    [Fact]
    public async Task SendMessage_SameTextDifferentClientMessageIds_CreatesTwoMessages()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var buyer = new User { Id = 20, FullName = "Buyer User", MobileNumber = "9876543211" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "iPhone 15",
            Price = 75000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        var conv = new ChatConversation
        {
            Id = 50,
            ListingId = listing.Id,
            BuyerId = buyer.Id,
            SellerId = seller.Id
        };
        db.Users.AddRange(seller, buyer);
        db.MarketplaceListings.Add(listing);
        db.ChatConversations.Add(conv);
        await db.SaveChangesAsync();

        var controller = new MarketplaceController(db);
        SetUserContext(controller, buyer.Id);

        var res1 = await controller.SendMessage(conv.Id, new SendChatMessageRequest
        {
            MessageText = "Hello",
            ClientMessageId = "client-msg-A"
        });
        var ok1 = Assert.IsType<OkObjectResult>(res1.Result);
        var api1 = Assert.IsType<ApiResponse<ChatMessageDto>>(ok1.Value);
        Assert.True(api1.Success);

        // Intentional second "Hello" with a new client id must NOT be treated as a retry
        var res2 = await controller.SendMessage(conv.Id, new SendChatMessageRequest
        {
            MessageText = "Hello",
            ClientMessageId = "client-msg-B"
        });
        var ok2 = Assert.IsType<OkObjectResult>(res2.Result);
        var api2 = Assert.IsType<ApiResponse<ChatMessageDto>>(ok2.Value);
        Assert.True(api2.Success);

        Assert.NotEqual(api1.Data!.Id, api2.Data!.Id);
        var totalMessages = await db.ChatMessages.Where(m => m.ConversationId == conv.Id).CountAsync();
        Assert.Equal(2, totalMessages);
    }

    [Fact]
    public async Task SendMessage_SendsNotificationToSellerNotBuyer()
    {
        using var db = GetInMemoryDbContext();
        var seller = new User { Id = 10, FullName = "Seller User", MobileNumber = "9876543210" };
        var buyer = new User { Id = 20, FullName = "Buyer User", MobileNumber = "9876543211" };
        var listing = new MarketplaceListing
        {
            Id = 100,
            UserId = seller.Id,
            Title = "Sony Headphones",
            Price = 18000m,
            IsActive = true,
            Status = ListingStatus.Active
        };
        var conv = new ChatConversation
        {
            Id = 50,
            ListingId = listing.Id,
            BuyerId = buyer.Id,
            SellerId = seller.Id
        };
        db.Users.AddRange(seller, buyer);
        db.MarketplaceListings.Add(listing);
        db.ChatConversations.Add(conv);
        await db.SaveChangesAsync();

        long? notifiedUserId = null;
        string? notifiedTitle = null;
        string? notifiedType = null;

        var mockNotifService = new MockNotificationTracker((userId, title, body, type, refId) =>
        {
            notifiedUserId = userId;
            notifiedTitle = title;
            notifiedType = type;
            return Task.FromResult(true);
        });

        var controller = new MarketplaceController(db, notificationService: mockNotifService);
        SetUserContext(controller, buyer.Id);

        var res = await controller.SendMessage(conv.Id, new SendChatMessageRequest
        {
            MessageText = "I want to buy this"
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var api = Assert.IsType<ApiResponse<ChatMessageDto>>(ok.Value);
        Assert.True(api.Success);

        // Verify seller received notification, NOT buyer
        Assert.Equal(seller.Id, notifiedUserId);
        Assert.Contains("Buyer User", notifiedTitle);
        Assert.Equal("MARKETPLACE_CHAT", notifiedType);
    }

    private class MockNotificationTracker : INotificationService
    {
        private readonly Func<long, string, string, string, string?, Task<bool>> _onSend;

        public MockNotificationTracker(Func<long, string, string, string, string?, Task<bool>> onSend)
        {
            _onSend = onSend;
        }

        public Task<bool> SendPushNotificationAsync(long userId, string title, string body, string type, string? referenceId = null)
        {
            return _onSend(userId, title, body, type, referenceId);
        }

        public Task<bool> SendBroadcastNotificationAsync(string title, string body, string module, bool persistInApp = true)
        {
            return Task.FromResult(true);
        }

        public Task<PushDispatchResult> BroadcastRideToAllCaptainsAsync(Ride ride)
        {
            return Task.FromResult(PushDispatchResult.NoCaptains());
        }
    }
}
