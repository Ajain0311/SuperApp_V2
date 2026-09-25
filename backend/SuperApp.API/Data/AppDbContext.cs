using Microsoft.EntityFrameworkCore;
using SuperApp.API.Models;

namespace SuperApp.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<OtpRequest> OtpRequests => Set<OtpRequest>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<RestaurantUser> RestaurantUsers => Set<RestaurantUser>();
    public DbSet<RestaurantCategory> RestaurantCategories => Set<RestaurantCategory>();
    public DbSet<FoodItem> FoodItems => Set<FoodItem>();
    public DbSet<FoodItemAddon> FoodItemAddons => Set<FoodItemAddon>();
    public DbSet<FoodItemVariant> FoodItemVariants => Set<FoodItemVariant>();
    public DbSet<FoodOrder> FoodOrders => Set<FoodOrder>();
    public DbSet<FoodOrderItem> FoodOrderItems => Set<FoodOrderItem>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Ride> Rides => Set<Ride>();
    public DbSet<MarketplaceCategory> MarketplaceCategories => Set<MarketplaceCategory>();
    public DbSet<MarketplaceListing> MarketplaceListings => Set<MarketplaceListing>();
    public DbSet<ListingImage> ListingImages => Set<ListingImage>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<CouponUsage> CouponUsages => Set<CouponUsage>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<UserDeviceToken> UserDeviceTokens => Set<UserDeviceToken>();
    public DbSet<MarketplaceOffer> MarketplaceOffers => Set<MarketplaceOffer>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.MobileNumber).IsUnique();
            if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
            {
                entity.HasIndex(e => e.Email).IsUnique().HasFilter("\"email\" IS NOT NULL");
            }
            else if (Database.ProviderName?.Contains("SqlServer", StringComparison.OrdinalIgnoreCase) == true)
            {
                entity.HasIndex(e => e.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
            }
            else
            {
                entity.HasIndex(e => e.Email).IsUnique();
            }
        });
        
        // Role
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(e => e.Name).IsUnique();
        });
        
        // UserRole
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.RoleId }).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(e => e.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // OtpRequest
        modelBuilder.Entity<OtpRequest>(entity =>
        {
            entity.HasIndex(e => e.MobileNumber);
            entity.HasIndex(e => e.ExpiresAt);
        });
        
        // Address
        modelBuilder.Entity<Address>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User)
                .WithMany(u => u.Addresses)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Restaurant
        modelBuilder.Entity<Restaurant>(entity =>
        {
            entity.HasIndex(e => e.City);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.IsFeatured);
        });
        
        // RestaurantUser
        modelBuilder.Entity<RestaurantUser>(entity =>
        {
            entity.HasIndex(e => new { e.RestaurantId, e.UserId }).IsUnique();
            entity.HasOne(e => e.Restaurant)
                .WithMany(r => r.RestaurantUsers)
                .HasForeignKey(e => e.RestaurantId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User)
                .WithMany(u => u.RestaurantUsers)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // RestaurantCategory
        modelBuilder.Entity<RestaurantCategory>(entity =>
        {
            entity.HasIndex(e => e.RestaurantId);
            entity.HasOne(e => e.Restaurant)
                .WithMany(r => r.Categories)
                .HasForeignKey(e => e.RestaurantId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // FoodItem
        modelBuilder.Entity<FoodItem>(entity =>
        {
            entity.HasIndex(e => e.RestaurantId);
            entity.HasIndex(e => e.RestaurantCategoryId);
            entity.HasIndex(e => e.IsAvailable);
            entity.HasOne(e => e.Restaurant)
                .WithMany(r => r.FoodItems)
                .HasForeignKey(e => e.RestaurantId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.RestaurantCategory)
                .WithMany(c => c.FoodItems)
                .HasForeignKey(e => e.RestaurantCategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // FoodItemAddon
        modelBuilder.Entity<FoodItemAddon>(entity =>
        {
            entity.HasIndex(e => e.FoodItemId);
            entity.HasOne(e => e.FoodItem)
                .WithMany(f => f.Addons)
                .HasForeignKey(e => e.FoodItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // FoodItemVariant
        modelBuilder.Entity<FoodItemVariant>(entity =>
        {
            entity.HasIndex(e => e.FoodItemId);
            entity.HasOne(e => e.FoodItem)
                .WithMany(f => f.Variants)
                .HasForeignKey(e => e.FoodItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // FoodOrder
        modelBuilder.Entity<FoodOrder>(entity =>
        {
            entity.HasIndex(e => e.OrderNumber).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.RestaurantId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Restaurant)
                .WithMany(r => r.FoodOrders)
                .HasForeignKey(e => e.RestaurantId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Address)
                .WithMany()
                .HasForeignKey(e => e.AddressId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.Coupon)
                .WithMany()
                .HasForeignKey(e => e.CouponId)
                .OnDelete(DeleteBehavior.SetNull);
        });
        
        // FoodOrderItem
        modelBuilder.Entity<FoodOrderItem>(entity =>
        {
            entity.HasIndex(e => e.FoodOrderId);
            entity.HasOne(e => e.FoodOrder)
                .WithMany(o => o.Items)
                .HasForeignKey(e => e.FoodOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.FoodItem)
                .WithMany()
                .HasForeignKey(e => e.FoodItemId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // Driver
        modelBuilder.Entity<Driver>(entity =>
        {
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Vehicle
        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.HasIndex(e => e.DriverId);
            entity.HasIndex(e => e.RegistrationNumber).IsUnique();
            entity.HasOne(e => e.Driver)
                .WithMany(d => d.Vehicles)
                .HasForeignKey(e => e.DriverId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Ride
        modelBuilder.Entity<Ride>(entity =>
        {
            entity.HasIndex(e => e.RideNumber).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.DriverId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Driver)
                .WithMany(d => d.Rides)
                .HasForeignKey(e => e.DriverId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Vehicle)
                .WithMany()
                .HasForeignKey(e => e.VehicleId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // MarketplaceCategory
        modelBuilder.Entity<MarketplaceCategory>(entity =>
        {
            entity.HasIndex(e => e.Name).IsUnique();
        });
        
        // MarketplaceListing
        modelBuilder.Entity<MarketplaceListing>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Category)
                .WithMany(c => c.Listings)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // ListingImage
        modelBuilder.Entity<ListingImage>(entity =>
        {
            entity.HasIndex(e => e.ListingId);
            entity.HasOne(e => e.Listing)
                .WithMany(l => l.Images)
                .HasForeignKey(e => e.ListingId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Favorite
        modelBuilder.Entity<Favorite>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.ListingId }).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Listing)
                .WithMany(l => l.Favorites)
                .HasForeignKey(e => e.ListingId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // Coupon
        modelBuilder.Entity<Coupon>(entity =>
        {
            entity.HasIndex(e => e.Code).IsUnique();
            entity.HasIndex(e => e.IsActive);
        });
        
        // CouponUsage
        modelBuilder.Entity<CouponUsage>(entity =>
        {
            entity.HasIndex(e => new { e.CouponId, e.UserId });
            entity.HasOne(e => e.Coupon)
                .WithMany(c => c.Usages)
                .HasForeignKey(e => e.CouponId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // Banner
        modelBuilder.Entity<Banner>(entity =>
        {
            entity.HasIndex(e => e.Module);
            entity.HasIndex(e => e.IsActive);
        });
        
        // Review
        modelBuilder.Entity<Review>(entity =>
        {
            entity.HasIndex(e => new { e.TargetType, e.TargetId });
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Notification
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.IsRead);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // Payment
        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.TransactionId);
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // AppSetting
        modelBuilder.Entity<AppSetting>(entity =>
        {
            entity.HasIndex(e => e.SettingKey).IsUnique();
        });
        
        // UserDeviceToken
        modelBuilder.Entity<UserDeviceToken>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.DeviceToken }).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        
        // MarketplaceOffer
        modelBuilder.Entity<MarketplaceOffer>(entity =>
        {
            entity.HasIndex(e => e.ListingId);
            entity.HasIndex(e => e.BuyerId);
            entity.HasIndex(e => e.SellerId);
            entity.HasOne(e => e.Listing)
                .WithMany()
                .HasForeignKey(e => e.ListingId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Buyer)
                .WithMany()
                .HasForeignKey(e => e.BuyerId)
                .OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(e => e.Seller)
                .WithMany()
                .HasForeignKey(e => e.SellerId)
                .OnDelete(DeleteBehavior.NoAction);
        });
        
        // Seed Roles
        modelBuilder.Entity<Role>().HasData(
            new Role { Id = 1, Name = RoleNames.Customer, Description = "Regular customer", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Role { Id = 2, Name = RoleNames.Admin, Description = "System administrator", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Role { Id = 3, Name = RoleNames.RestaurantOwner, Description = "Restaurant owner/manager", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Role { Id = 4, Name = RoleNames.Driver, Description = "Ride driver", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Role { Id = 5, Name = RoleNames.MarketplaceSeller, Description = "Marketplace seller", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
        
        // Seed default admin user (password: Admin@123)
        modelBuilder.Entity<User>().HasData(
            new User 
            { 
                Id = 1, 
                MobileNumber = "9999999999", 
                FullName = "Super Admin", 
                Email = "admin@superapp.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
        
        modelBuilder.Entity<UserRole>().HasData(
            new UserRole { Id = 1, UserId = 1, RoleId = 2, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
        
        // Seed marketplace categories
        modelBuilder.Entity<MarketplaceCategory>().HasData(
            new MarketplaceCategory { Id = 1, Name = "Mobiles", SortOrder = 1, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 2, Name = "Vehicles", SortOrder = 2, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 3, Name = "Electronics", SortOrder = 3, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 4, Name = "Furniture", SortOrder = 4, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 5, Name = "Fashion", SortOrder = 5, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 6, Name = "Books", SortOrder = 6, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 7, Name = "Sports", SortOrder = 7, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new MarketplaceCategory { Id = 8, Name = "Others", SortOrder = 8, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
    }
}
