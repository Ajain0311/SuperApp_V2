using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketplaceController : ControllerBase
{
    private readonly AppDbContext _db;

    public MarketplaceController(AppDbContext db)
    {
        _db = db;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1; // Default development user
    }

    /// <summary>
    /// Get all marketplace categories with listing count
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<ApiResponse<List<MarketplaceCategoryDto>>>> GetCategories()
    {
        var categories = await _db.MarketplaceCategories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new MarketplaceCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                IconUrl = c.IconUrl,
                ListingCount = c.Listings.Count(l => l.IsActive && l.Status == ListingStatus.Active)
            })
            .ToListAsync();

        if (!categories.Any())
        {
            // Return fallback default categories
            categories = GetFallbackCategories();
        }

        return Ok(ApiResponse<List<MarketplaceCategoryDto>>.Ok(categories));
    }

    /// <summary>
    /// Search and filter marketplace listings
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<ListingSummaryDto>>>> GetListings(
        [FromQuery] int? categoryId,
        [FromQuery] string? search,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? condition,
        [FromQuery] string? sortBy,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var currentUserId = GetCurrentUserId();
        var userFavorites = await _db.Favorites
            .Where(f => f.UserId == currentUserId)
            .Select(f => f.ListingId)
            .ToListAsync();

        var query = _db.MarketplaceListings
            .Include(l => l.Category)
            .Include(l => l.Images)
            .Where(l => l.IsActive && l.Status == ListingStatus.Active)
            .AsQueryable();

        if (categoryId.HasValue && categoryId.Value > 0)
        {
            query = query.Where(l => l.CategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(l => l.Title.Contains(term) || (l.Description != null && l.Description.Contains(term)) || (l.Location != null && l.Location.Contains(term)));
        }

        if (minPrice.HasValue)
        {
            query = query.Where(l => l.Price >= minPrice.Value);
        }

        if (maxPrice.HasValue)
        {
            query = query.Where(l => l.Price <= maxPrice.Value);
        }

        if (!string.IsNullOrWhiteSpace(condition))
        {
            query = query.Where(l => l.Condition == condition);
        }

        query = sortBy?.ToLowerInvariant() switch
        {
            "price_asc" => query.OrderBy(l => l.Price),
            "price_desc" => query.OrderByDescending(l => l.Price),
            "popular" => query.OrderByDescending(l => l.ViewCount),
            _ => query.OrderByDescending(l => l.IsFeatured).ThenByDescending(l => l.CreatedAt)
        };

        var totalCount = await query.CountAsync();

        List<ListingSummaryDto> items;

        if (totalCount == 0 && !categoryId.HasValue && string.IsNullOrWhiteSpace(search))
        {
            // Provide high-quality fallback items for immediate test experience
            var fallbacks = GetFallbackListings(userFavorites);
            items = fallbacks.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            totalCount = fallbacks.Count;
        }
        else
        {
            items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(l => new ListingSummaryDto
                {
                    Id = l.Id,
                    Title = l.Title,
                    Price = l.Price,
                    Condition = l.Condition,
                    Location = l.Location,
                    PrimaryImageUrl = l.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault() ?? "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
                    IsFeatured = l.IsFeatured,
                    ViewCount = l.ViewCount,
                    Status = l.Status,
                    CreatedAt = l.CreatedAt,
                    CategoryId = l.CategoryId,
                    CategoryName = l.Category != null ? l.Category.Name : "General",
                    IsFavorite = userFavorites.Contains(l.Id)
                })
                .ToListAsync();
        }

        var result = new PagedResult<ListingSummaryDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };

        return Ok(ApiResponse<PagedResult<ListingSummaryDto>>.Ok(result));
    }

    /// <summary>
    /// Get single listing details with seller profile and photos
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ListingDetailDto>>> GetListingById(long id)
    {
        var currentUserId = GetCurrentUserId();

        var listing = await _db.MarketplaceListings
            .Include(l => l.Category)
            .Include(l => l.Images)
            .Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Id == id && l.IsActive);

        if (listing == null)
        {
            // Check fallback items
            var fallback = GetFallbackListings(new List<long>()).FirstOrDefault(f => f.Id == id);
            if (fallback != null)
            {
                var detailFallback = new ListingDetailDto
                {
                    Id = fallback.Id,
                    Title = fallback.Title,
                    Description = "Excellent condition, sparingly used, authentic with original box and bill. Price slightly negotiable for immediate buyers. Pickup available at location.",
                    Price = fallback.Price,
                    Condition = fallback.Condition,
                    Location = fallback.Location,
                    Status = fallback.Status,
                    IsFeatured = fallback.IsFeatured,
                    ViewCount = fallback.ViewCount + 1,
                    CreatedAt = fallback.CreatedAt,
                    CategoryId = fallback.CategoryId,
                    CategoryName = fallback.CategoryName,
                    SellerId = 1,
                    SellerName = "Aditya Sharma",
                    SellerPhone = "9876543210",
                    SellerAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                    SellerJoinedAt = DateTime.UtcNow.AddMonths(-8),
                    IsFavorite = false,
                    Images = new List<string> { fallback.PrimaryImageUrl ?? "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600" }
                };
                return Ok(ApiResponse<ListingDetailDto>.Ok(detailFallback));
            }

            return NotFound(ApiResponse<ListingDetailDto>.Fail("Listing not found"));
        }

        // Increment view count
        listing.ViewCount++;
        await _db.SaveChangesAsync();

        var isFavorite = await _db.Favorites.AnyAsync(f => f.UserId == currentUserId && f.ListingId == id);

        var dto = new ListingDetailDto
        {
            Id = listing.Id,
            Title = listing.Title,
            Description = listing.Description,
            Price = listing.Price,
            Condition = listing.Condition,
            Location = listing.Location,
            Latitude = listing.Latitude,
            Longitude = listing.Longitude,
            Status = listing.Status,
            IsFeatured = listing.IsFeatured,
            ViewCount = listing.ViewCount,
            CreatedAt = listing.CreatedAt,
            CategoryId = listing.CategoryId,
            CategoryName = listing.Category?.Name ?? "General",
            SellerId = listing.UserId,
            SellerName = listing.User?.FullName ?? "Community Member",
            SellerPhone = listing.User?.MobileNumber,
            SellerAvatar = listing.User?.ProfileImageUrl,
            SellerJoinedAt = listing.User?.CreatedAt,
            IsFavorite = isFavorite,
            Images = listing.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).ToList()
        };

        if (!dto.Images.Any())
        {
            dto.Images.Add("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600");
        }

        return Ok(ApiResponse<ListingDetailDto>.Ok(dto));
    }

    /// <summary>
    /// Minimal Action Endpoint for Marketplace Listings: ADD, EDIT, DELETE, STATUS
    /// </summary>
    [HttpPost("listings")]
    public async Task<ActionResult<ApiResponse<ListingSummaryDto>>> ManageListing([FromBody] ListingActionRequest request)
    {
        var currentUserId = GetCurrentUserId();

        switch (request.Action?.ToUpperInvariant())
        {
            case "ADD":
                if (string.IsNullOrWhiteSpace(request.Title))
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Title is required"));
                if (!request.CategoryId.HasValue || request.CategoryId.Value <= 0)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Valid category is required"));
                if (!request.Price.HasValue || request.Price.Value < 0)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Valid price is required"));

                // Auto-grant MARKETPLACE_SELLER role if needed
                var hasSellerRole = await _db.UserRoles.AnyAsync(ur => ur.UserId == currentUserId && ur.RoleId == 5);
                if (!hasSellerRole)
                {
                    _db.UserRoles.Add(new UserRole
                    {
                        UserId = currentUserId,
                        RoleId = 5,
                        CreatedAt = DateTime.UtcNow
                    });
                }

                var newListing = new MarketplaceListing
                {
                    UserId = currentUserId,
                    CategoryId = request.CategoryId.Value,
                    Title = request.Title.Trim(),
                    Description = request.Description?.Trim(),
                    Price = request.Price.Value,
                    Condition = NormalizeListingCondition(request.Condition),
                    Location = request.Location?.Trim() ?? "Bengaluru",
                    Latitude = request.Latitude,
                    Longitude = request.Longitude,
                    Status = ListingStatus.Active,
                    IsFeatured = false,
                    ViewCount = 0,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _db.MarketplaceListings.Add(newListing);
                await _db.SaveChangesAsync();

                if (request.ImageUrls != null && request.ImageUrls.Any())
                {
                    int order = 1;
                    foreach (var img in request.ImageUrls)
                    {
                        if (!string.IsNullOrWhiteSpace(img))
                        {
                            _db.ListingImages.Add(new ListingImage
                            {
                                ListingId = newListing.Id,
                                ImageUrl = img.Trim(),
                                SortOrder = order++,
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                    await _db.SaveChangesAsync();
                }

                var cat = await _db.MarketplaceCategories.FindAsync(newListing.CategoryId);

                return Ok(ApiResponse<ListingSummaryDto>.Ok(new ListingSummaryDto
                {
                    Id = newListing.Id,
                    Title = newListing.Title,
                    Price = newListing.Price,
                    Condition = newListing.Condition,
                    Location = newListing.Location,
                    PrimaryImageUrl = request.ImageUrls?.FirstOrDefault() ?? "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
                    IsFeatured = newListing.IsFeatured,
                    ViewCount = 0,
                    Status = newListing.Status,
                    CreatedAt = newListing.CreatedAt,
                    CategoryId = newListing.CategoryId,
                    CategoryName = cat?.Name ?? "General",
                    IsFavorite = false
                }, "Listing published successfully"));

            case "EDIT":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Listing ID is required for EDIT"));

                var listingToEdit = await _db.MarketplaceListings
                    .Include(l => l.Category)
                    .Include(l => l.Images)
                    .FirstOrDefaultAsync(l => l.Id == request.Id.Value && l.IsActive);

                if (listingToEdit == null)
                    return NotFound(ApiResponse<ListingSummaryDto>.Fail("Listing not found"));

                if (listingToEdit.UserId != currentUserId)
                    return Forbid();

                if (!string.IsNullOrWhiteSpace(request.Title)) listingToEdit.Title = request.Title.Trim();
                if (!string.IsNullOrWhiteSpace(request.Description)) listingToEdit.Description = request.Description.Trim();
                if (request.Price.HasValue && request.Price.Value >= 0) listingToEdit.Price = request.Price.Value;
                if (!string.IsNullOrWhiteSpace(request.Condition)) listingToEdit.Condition = request.Condition.Trim().ToUpperInvariant();
                if (!string.IsNullOrWhiteSpace(request.Location)) listingToEdit.Location = request.Location.Trim();
                if (request.CategoryId.HasValue && request.CategoryId.Value > 0) listingToEdit.CategoryId = request.CategoryId.Value;
                listingToEdit.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                return Ok(ApiResponse<ListingSummaryDto>.Ok(new ListingSummaryDto
                {
                    Id = listingToEdit.Id,
                    Title = listingToEdit.Title,
                    Price = listingToEdit.Price,
                    Condition = listingToEdit.Condition,
                    Location = listingToEdit.Location,
                    PrimaryImageUrl = listingToEdit.Images.FirstOrDefault()?.ImageUrl,
                    IsFeatured = listingToEdit.IsFeatured,
                    ViewCount = listingToEdit.ViewCount,
                    Status = listingToEdit.Status,
                    CreatedAt = listingToEdit.CreatedAt,
                    CategoryId = listingToEdit.CategoryId,
                    CategoryName = listingToEdit.Category?.Name ?? "General",
                    IsFavorite = false
                }, "Listing updated successfully"));

            case "DELETE":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Listing ID is required for DELETE"));

                var listingToDelete = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == request.Id.Value);
                if (listingToDelete == null)
                    return NotFound(ApiResponse<ListingSummaryDto>.Fail("Listing not found"));

                if (listingToDelete.UserId != currentUserId)
                    return Forbid();

                listingToDelete.IsActive = false;
                listingToDelete.Status = ListingStatus.Removed;
                listingToDelete.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                return Ok(ApiResponse<ListingSummaryDto>.Ok(null!, "Listing removed successfully"));

            case "STATUS":
                if (!request.Id.HasValue || string.IsNullOrWhiteSpace(request.Status))
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Listing ID and new Status are required"));

                var listingStatus = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == request.Id.Value);
                if (listingStatus == null)
                    return NotFound(ApiResponse<ListingSummaryDto>.Fail("Listing not found"));

                if (listingStatus.UserId != currentUserId)
                    return Forbid();

                listingStatus.Status = request.Status.Trim().ToUpperInvariant();
                listingStatus.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                return Ok(ApiResponse<ListingSummaryDto>.Ok(null!, $"Status updated to {listingStatus.Status}"));

            default:
                return BadRequest(ApiResponse<ListingSummaryDto>.Fail($"Unknown action: '{request.Action}'. Use ADD, EDIT, DELETE, or STATUS."));
        }
    }

    /// <summary>
    /// Get all listings posted by the current user
    /// </summary>
    [HttpGet("my-listings")]
    public async Task<ActionResult<ApiResponse<List<ListingSummaryDto>>>> GetMyListings()
    {
        var currentUserId = GetCurrentUserId();

        var listings = await _db.MarketplaceListings
            .Include(l => l.Category)
            .Include(l => l.Images)
            .Where(l => l.UserId == currentUserId && l.IsActive)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new ListingSummaryDto
            {
                Id = l.Id,
                Title = l.Title,
                Price = l.Price,
                Condition = l.Condition,
                Location = l.Location,
                PrimaryImageUrl = l.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                IsFeatured = l.IsFeatured,
                ViewCount = l.ViewCount,
                Status = l.Status,
                CreatedAt = l.CreatedAt,
                CategoryId = l.CategoryId,
                CategoryName = l.Category != null ? l.Category.Name : "General",
                IsFavorite = false
            })
            .ToListAsync();

        return Ok(ApiResponse<List<ListingSummaryDto>>.Ok(listings));
    }

    /// <summary>
    /// Toggle favorite status of a listing
    /// </summary>
    [HttpPost("favorites/{listingId}")]
    public async Task<ActionResult<ApiResponse<bool>>> ToggleFavorite(long listingId)
    {
        var currentUserId = GetCurrentUserId();

        var existing = await _db.Favorites.FirstOrDefaultAsync(f => f.UserId == currentUserId && f.ListingId == listingId);
        if (existing != null)
        {
            _db.Favorites.Remove(existing);
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<bool>.Ok(false, "Removed from favorites"));
        }

        _db.Favorites.Add(new Favorite
        {
            UserId = currentUserId,
            ListingId = listingId,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Added to favorites"));
    }

    /// <summary>
    /// Remove listing from favorites
    /// </summary>
    [HttpDelete("favorites/{listingId}")]
    public async Task<ActionResult<ApiResponse<bool>>> RemoveFavorite(long listingId)
    {
        var currentUserId = GetCurrentUserId();

        var existing = await _db.Favorites.FirstOrDefaultAsync(f => f.UserId == currentUserId && f.ListingId == listingId);
        if (existing != null)
        {
            _db.Favorites.Remove(existing);
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<bool>.Ok(false, "Removed from favorites"));
    }

    /// <summary>
    /// Get all favorited listings of current user
    /// </summary>
    [HttpGet("favorites")]
    public async Task<ActionResult<ApiResponse<List<ListingSummaryDto>>>> GetMyFavorites()
    {
        var currentUserId = GetCurrentUserId();

        var listings = await _db.Favorites
            .Where(f => f.UserId == currentUserId)
            .Include(f => f.Listing)
                .ThenInclude(l => l.Category)
            .Include(f => f.Listing)
                .ThenInclude(l => l.Images)
            .Where(f => f.Listing.IsActive && f.Listing.Status == ListingStatus.Active)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new ListingSummaryDto
            {
                Id = f.Listing.Id,
                Title = f.Listing.Title,
                Price = f.Listing.Price,
                Condition = f.Listing.Condition,
                Location = f.Listing.Location,
                PrimaryImageUrl = f.Listing.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                IsFeatured = f.Listing.IsFeatured,
                ViewCount = f.Listing.ViewCount,
                Status = f.Listing.Status,
                CreatedAt = f.Listing.CreatedAt,
                CategoryId = f.Listing.CategoryId,
                CategoryName = f.Listing.Category != null ? f.Listing.Category.Name : "General",
                IsFavorite = true
            })
            .ToListAsync();

        return Ok(ApiResponse<List<ListingSummaryDto>>.Ok(listings));
    }

    // --- Helpers & Seed Fallbacks ---
    private static List<MarketplaceCategoryDto> GetFallbackCategories() => new()
    {
        new MarketplaceCategoryDto { Id = 1, Name = "Mobiles", ListingCount = 4 },
        new MarketplaceCategoryDto { Id = 2, Name = "Vehicles", ListingCount = 2 },
        new MarketplaceCategoryDto { Id = 3, Name = "Electronics", ListingCount = 5 },
        new MarketplaceCategoryDto { Id = 4, Name = "Furniture", ListingCount = 3 },
        new MarketplaceCategoryDto { Id = 5, Name = "Fashion", ListingCount = 2 },
        new MarketplaceCategoryDto { Id = 6, Name = "Books", ListingCount = 1 },
        new MarketplaceCategoryDto { Id = 7, Name = "Sports", ListingCount = 2 },
        new MarketplaceCategoryDto { Id = 8, Name = "Others", ListingCount = 1 }
    };

    private static List<ListingSummaryDto> GetFallbackListings(List<long> userFavorites) => new()
    {
        new ListingSummaryDto
        {
            Id = 101,
            Title = "iPhone 14 Pro Max 256GB Deep Purple (Like New)",
            Price = 68000,
            Condition = "LIKE_NEW",
            Location = "Koramangala, Bengaluru",
            PrimaryImageUrl = "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=500",
            IsFeatured = true,
            ViewCount = 142,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            CategoryId = 1,
            CategoryName = "Mobiles",
            IsFavorite = userFavorites.Contains(101)
        },
        new ListingSummaryDto
        {
            Id = 102,
            Title = "Royal Enfield Classic 350 (2022 Stealth Black)",
            Price = 145000,
            Condition = "USED",
            Location = "Indiranagar, Bengaluru",
            PrimaryImageUrl = "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500",
            IsFeatured = true,
            ViewCount = 310,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            CategoryId = 2,
            CategoryName = "Vehicles",
            IsFavorite = userFavorites.Contains(102)
        },
        new ListingSummaryDto
        {
            Id = 103,
            Title = "Sony PlayStation 5 Disc Edition + 2 Controllers",
            Price = 38500,
            Condition = "LIKE_NEW",
            Location = "HSR Layout, Bengaluru",
            PrimaryImageUrl = "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=500",
            IsFeatured = false,
            ViewCount = 98,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddHours(-18),
            CategoryId = 3,
            CategoryName = "Electronics",
            IsFavorite = userFavorites.Contains(103)
        },
        new ListingSummaryDto
        {
            Id = 104,
            Title = "Solid Sheesham Teak Wood 6-Seater Dining Table",
            Price = 22000,
            Condition = "USED",
            Location = "Whitefield, Bengaluru",
            PrimaryImageUrl = "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=500",
            IsFeatured = false,
            ViewCount = 74,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
            CategoryId = 4,
            CategoryName = "Furniture",
            IsFavorite = userFavorites.Contains(104)
        },
        new ListingSummaryDto
        {
            Id = 105,
            Title = "Canon EOS 200D II DSLR with 18-55mm IS STM Lens",
            Price = 32000,
            Condition = "LIKE_NEW",
            Location = "Jayanagar, Bengaluru",
            PrimaryImageUrl = "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500",
            IsFeatured = false,
            ViewCount = 112,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-4),
            CategoryId = 3,
            CategoryName = "Electronics",
            IsFavorite = userFavorites.Contains(105)
        },
        new ListingSummaryDto
        {
            Id = 106,
            Title = "Zara Genuine Leather Biker Jacket (Black - Size M)",
            Price = 3999,
            Condition = "NEW",
            Location = "MG Road, Bengaluru",
            PrimaryImageUrl = "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500",
            IsFeatured = false,
            ViewCount = 65,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddHours(-6),
            CategoryId = 5,
            CategoryName = "Fashion",
            IsFavorite = userFavorites.Contains(106)
        }
    };
}
