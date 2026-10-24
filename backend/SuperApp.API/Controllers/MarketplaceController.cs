using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Microsoft.AspNetCore.SignalR;
using SuperApp.API.Hubs;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketplaceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub>? _chatHub;
    private readonly INotificationService? _notificationService;

    public MarketplaceController(
        AppDbContext db,
        IHubContext<ChatHub>? chatHub = null,
        INotificationService? notificationService = null)
    {
        _db = db;
        _chatHub = chatHub;
        _notificationService = notificationService;
    }

    private long? GetCurrentUserId()
    {
        var claim = User?.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return null;
    }

    private static string NormalizeListingCondition(string? condition)
    {
        var normalized = condition?.Trim().ToUpperInvariant();
        return normalized switch
        {
            "NEW" or "LIKE_NEW" or "USED" or "FAIR" => normalized,
            _ => "USED"
        };
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
        // Clamp pagination — negative page/pageSize made Skip/Take throw → HTTP 500
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var currentUserId = GetCurrentUserId();
        var userFavorites = currentUserId.HasValue
            ? await _db.Favorites.Where(f => f.UserId == currentUserId.Value).Select(f => f.ListingId).ToListAsync()
            : new List<long>();

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

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
                CategoryName = l.Category != null ? l.Category.Name : string.Empty,
                IsFavorite = userFavorites.Contains(l.Id)
            })
            .ToListAsync();

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
            return NotFound(ApiResponse<ListingDetailDto>.Fail("Listing not found"));

        // Increment view count
        listing.ViewCount++;
        await _db.SaveChangesAsync();

        var isFavorite = currentUserId.HasValue && await _db.Favorites.AnyAsync(f => f.UserId == currentUserId.Value && f.ListingId == id);

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
            CategoryName = listing.Category?.Name ?? string.Empty,
            SellerId = listing.UserId,
            SellerName = listing.User?.FullName?.Trim() ?? string.Empty,
            SellerPhone = string.IsNullOrWhiteSpace(listing.User?.MobileNumber) ? null : listing.User!.MobileNumber.Trim(),
            SellerAvatar = listing.User?.ProfileImageUrl,
            SellerJoinedAt = listing.User?.CreatedAt,
            IsFavorite = isFavorite,
            Images = listing.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).Where(u => !string.IsNullOrWhiteSpace(u)).ToList()
        };

        return Ok(ApiResponse<ListingDetailDto>.Ok(dto));
    }

    /// <summary>
    /// Minimal Action Endpoint for Marketplace Listings: ADD, EDIT, DELETE, STATUS
    /// </summary>
    [HttpPost("listings")]
    public async Task<ActionResult<ApiResponse<ListingSummaryDto>>> ManageListing([FromBody] ListingActionRequest request)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<ListingSummaryDto>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        switch (request.Action?.ToUpperInvariant())
        {
            case "ADD":
                if (string.IsNullOrWhiteSpace(request.Title))
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Title is required"));
                if (request.Title.Trim().Length > 200)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Title must be at most 200 characters"));
                if (request.Description != null && request.Description.Length > 2000)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Description must be at most 2000 characters"));
                if (!request.CategoryId.HasValue || request.CategoryId.Value <= 0)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Valid category is required"));
                if (!request.Price.HasValue || request.Price.Value < 0)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Valid price is required"));

                // Auto-grant MARKETPLACE_SELLER by role name (never hardcode RoleId — prod ids differ from seed).
                try
                {
                    var sellerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.MarketplaceSeller);
                    if (sellerRole == null)
                    {
                        sellerRole = new Role
                        {
                            Name = RoleNames.MarketplaceSeller,
                            Description = "Marketplace seller",
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow
                        };
                        _db.Roles.Add(sellerRole);
                        await _db.SaveChangesAsync();
                    }

                    var hasSellerRole = await _db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == sellerRole.Id);
                    if (!hasSellerRole)
                    {
                        _db.UserRoles.Add(new UserRole
                        {
                            UserId = userId,
                            RoleId = sellerRole.Id,
                            CreatedAt = DateTime.UtcNow
                        });
                        await _db.SaveChangesAsync();
                    }
                }
                catch (Exception roleEx)
                {
                    // Listing publish must not fail if role grant has a transient issue.
                    Console.WriteLine($"[MarketplaceController] Auto-assign seller role skipped: {roleEx.Message}");
                    // Clear any failed tracked role/user_role entities so listing save is clean.
                    foreach (var entry in _db.ChangeTracker.Entries()
                                 .Where(e => e.Entity is Role or UserRole && e.State != EntityState.Unchanged)
                                 .ToList())
                    {
                        entry.State = EntityState.Detached;
                    }
                }

                // Ensure category exists or fall back to first active
                var cat = await _db.MarketplaceCategories.FindAsync(request.CategoryId.Value);
                if (cat == null || !cat.IsActive)
                {
                    cat = await _db.MarketplaceCategories.Where(c => c.IsActive).OrderBy(c => c.SortOrder).FirstOrDefaultAsync();
                    if (cat == null)
                        return BadRequest(ApiResponse<ListingSummaryDto>.Fail("No marketplace categories available"));
                    request.CategoryId = cat.Id;
                }

                var newListing = new MarketplaceListing
                {
                    UserId = userId,
                    CategoryId = cat.Id,
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
                try
                {
                    await _db.SaveChangesAsync();
                }
                catch (DbUpdateException dbEx)
                {
                    // If sequence is out of sync in PostgreSQL, resync sequence and retry once
                    try
                    {
                        await _db.Database.ExecuteSqlRawAsync(
                            "SELECT setval(pg_get_serial_sequence('marketplace_listings', 'id'), COALESCE((SELECT MAX(id) FROM marketplace_listings), 1));"
                        );
                        _db.Entry(newListing).State = EntityState.Detached;
                        newListing.Id = 0;
                        _db.MarketplaceListings.Add(newListing);
                        await _db.SaveChangesAsync();
                    }
                    catch
                    {
                        throw dbEx;
                    }
                }

                if (request.ImageUrls != null && request.ImageUrls.Any())
                {
                    try
                    {
                        int order = 1;
                        foreach (var img in request.ImageUrls)
                        {
                            if (!string.IsNullOrWhiteSpace(img))
                            {
                                var cleanUrl = img.Trim();
                                if (cleanUrl.Length > 500)
                                    cleanUrl = cleanUrl.Substring(0, 500);

                                _db.ListingImages.Add(new ListingImage
                                {
                                    ListingId = newListing.Id,
                                    ImageUrl = cleanUrl,
                                    SortOrder = order++,
                                    CreatedAt = DateTime.UtcNow
                                });
                            }
                        }
                        await _db.SaveChangesAsync();
                    }
                    catch (DbUpdateException)
                    {
                        try
                        {
                            await _db.Database.ExecuteSqlRawAsync(
                                "SELECT setval(pg_get_serial_sequence('listing_images', 'id'), COALESCE((SELECT MAX(id) FROM listing_images), 1));"
                            );
                            await _db.SaveChangesAsync();
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[MarketplaceController] Failed to save listing images: {ex.Message}");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[MarketplaceController] Failed to save listing images: {ex.Message}");
                    }
                }

                var dto = new ListingSummaryDto
                {
                    Id = newListing.Id,
                    Title = newListing.Title,
                    Price = newListing.Price,
                    Condition = newListing.Condition,
                    Location = newListing.Location,
                    PrimaryImageUrl = request.ImageUrls?.FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)),
                    IsFeatured = newListing.IsFeatured,
                    ViewCount = 0,
                    Status = newListing.Status,
                    CreatedAt = newListing.CreatedAt,
                    CategoryId = newListing.CategoryId,
                    CategoryName = cat.Name,
                    IsFavorite = false
                };

                try
                {
                    var witty = WittyNotificationCatalog.GetRandomSellerLine();
                    _db.Notifications.Add(new Notification
                    {
                        UserId = userId,
                        Title = witty.Title,
                        Body = $"{witty.Body} (Item: {newListing.Title} for ₹{newListing.Price})",
                        Type = "MARKETPLACE",
                        ReferenceId = newListing.Id.ToString(),
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                    await _db.SaveChangesAsync();
                }
                catch { }

                return Ok(ApiResponse<ListingSummaryDto>.Ok(dto, "Listing published successfully"));

            case "EDIT":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Listing ID is required for EDIT"));

                var listingToEdit = await _db.MarketplaceListings
                    .Include(l => l.Category)
                    .Include(l => l.Images)
                    .FirstOrDefaultAsync(l => l.Id == request.Id.Value && l.IsActive);

                if (listingToEdit == null)
                    return NotFound(ApiResponse<ListingSummaryDto>.Fail("Listing not found"));

                if (listingToEdit.UserId != userId && !User.IsInRole(RoleNames.Admin))
                    return Forbid();

                if (!string.IsNullOrWhiteSpace(request.Title)) listingToEdit.Title = request.Title.Trim();
                if (!string.IsNullOrWhiteSpace(request.Description)) listingToEdit.Description = request.Description.Trim();
                if (request.Price.HasValue && request.Price.Value >= 0) listingToEdit.Price = request.Price.Value;
                if (!string.IsNullOrWhiteSpace(request.Condition)) listingToEdit.Condition = NormalizeListingCondition(request.Condition);
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
                    CategoryName = listingToEdit.Category?.Name ?? string.Empty,
                    IsFavorite = false
                }, "Listing updated successfully"));

            case "DELETE":
                if (!request.Id.HasValue)
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Listing ID is required for DELETE"));

                var listingToDelete = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == request.Id.Value);
                if (listingToDelete == null)
                    return NotFound(ApiResponse<ListingSummaryDto>.Fail("Listing not found"));

                if (listingToDelete.UserId != userId && !User.IsInRole(RoleNames.Admin))
                    return Forbid();

                listingToDelete.IsActive = false;
                listingToDelete.Status = ListingStatus.Removed;
                listingToDelete.UpdatedAt = DateTime.UtcNow;
                var imageUrls = await _db.ListingImages.Where(i => i.ListingId == listingToDelete.Id).Select(i => i.ImageUrl).ToListAsync();
                var documentNos = imageUrls.Select(DocumentsController.DocumentNoFromUrl).Where(n => n != null).Cast<string>().ToList();
                if (documentNos.Count > 0)
                {
                    var docs = await _db.Documents.Where(d => documentNos.Contains(d.DocumentNo) && d.OwnerUserId == listingToDelete.UserId).ToListAsync();
                    _db.Documents.RemoveRange(docs);
                }
                await _db.SaveChangesAsync();

                return Ok(ApiResponse<ListingSummaryDto>.Ok(null!, "Listing removed successfully"));

            case "STATUS":
                if (!request.Id.HasValue || string.IsNullOrWhiteSpace(request.Status))
                    return BadRequest(ApiResponse<ListingSummaryDto>.Fail("Listing ID and new Status are required"));

                var listingStatus = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == request.Id.Value);
                if (listingStatus == null)
                    return NotFound(ApiResponse<ListingSummaryDto>.Fail("Listing not found"));

                if (listingStatus.UserId != userId && !User.IsInRole(RoleNames.Admin))
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
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<List<ListingSummaryDto>>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        var listings = await _db.MarketplaceListings
            .Include(l => l.Category)
            .Include(l => l.Images)
            .Where(l => l.UserId == userId && l.IsActive)
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
                CategoryName = l.Category != null ? l.Category.Name : string.Empty,
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
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<bool>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        // Relational: atomic delete-then-insert avoids concurrent remove/add 500s
        if (_db.Database.IsRelational())
        {
            var deleted = await _db.Favorites
                .Where(f => f.UserId == userId && f.ListingId == listingId)
                .ExecuteDeleteAsync();
            if (deleted > 0)
                return Ok(ApiResponse<bool>.Ok(false, "Removed from favorites"));

            var listingExists = await _db.MarketplaceListings.AnyAsync(l => l.Id == listingId && l.IsActive);
            if (!listingExists)
                return NotFound(ApiResponse<bool>.Fail("Listing not found"));

            try
            {
                _db.Favorites.Add(new Favorite
                {
                    UserId = userId,
                    ListingId = listingId,
                    CreatedAt = DateTime.UtcNow
                });
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<bool>.Ok(true, "Added to favorites"));
            }
            catch (DbUpdateException)
            {
                // Concurrent inserts raced the unique (user_id, listing_id) key
                _db.ChangeTracker.Clear();
                return Ok(ApiResponse<bool>.Ok(true, "Already in favorites"));
            }
        }

        // InMemory fallback (no ExecuteDelete)
        var existing = await _db.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.ListingId == listingId);
        if (existing != null)
        {
            _db.Favorites.Remove(existing);
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<bool>.Ok(false, "Removed from favorites"));
        }

        var listingOk = await _db.MarketplaceListings.AnyAsync(l => l.Id == listingId && l.IsActive);
        if (!listingOk)
            return NotFound(ApiResponse<bool>.Fail("Listing not found"));

        _db.Favorites.Add(new Favorite
        {
            UserId = userId,
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
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<bool>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        // Atomic delete avoids concurrent RemoveFavorite / ToggleFavorite DbUpdateConcurrencyException → 500
        if (_db.Database.IsRelational())
        {
            await _db.Favorites
                .Where(f => f.UserId == userId && f.ListingId == listingId)
                .ExecuteDeleteAsync();
            return Ok(ApiResponse<bool>.Ok(false, "Removed from favorites"));
        }

        var existing = await _db.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.ListingId == listingId);
        if (existing != null)
        {
            try
            {
                _db.Favorites.Remove(existing);
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                _db.ChangeTracker.Clear();
            }
            catch (DbUpdateException)
            {
                _db.ChangeTracker.Clear();
            }
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
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<List<ListingSummaryDto>>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        var listings = await _db.Favorites
            .Where(f => f.UserId == userId)
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
                CategoryName = f.Listing.Category != null ? f.Listing.Category.Name : string.Empty,
                IsFavorite = true
            })
            .ToListAsync();

        return Ok(ApiResponse<List<ListingSummaryDto>>.Ok(listings));
    }

    /// <summary>
    /// Create or update an offer on a marketplace listing
    /// </summary>
    [HttpPost("listings/{id:long}/offer")]
    public async Task<ActionResult<ApiResponse<OfferDto>>> MakeOffer(long id, [FromBody] CreateOfferRequest request)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<OfferDto>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        if (request.OfferedPrice <= 0)
            return BadRequest(ApiResponse<OfferDto>.Fail("Offered price must be greater than zero"));

        var listing = await _db.MarketplaceListings
            .Include(l => l.User)
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == id && l.IsActive);

        if (listing == null)
            return NotFound(ApiResponse<OfferDto>.Fail("Listing not found"));

        if (listing.UserId == userId)
            return BadRequest(ApiResponse<OfferDto>.Fail("You cannot make an offer on your own listing"));

        if (listing.Status != ListingStatus.Active)
            return BadRequest(ApiResponse<OfferDto>.Fail("This listing is no longer active for offers"));

        var buyer = await _db.Users.FindAsync(userId);

        // Check for existing pending offer by this buyer
        var offer = await _db.MarketplaceOffers
            .FirstOrDefaultAsync(o => o.ListingId == id && o.BuyerId == userId && o.Status == OfferStatus.Pending);

        if (offer != null)
        {
            offer.OfferedPrice = request.OfferedPrice;
            offer.Message = request.Message;
            offer.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            offer = new MarketplaceOffer
            {
                ListingId = listing.Id,
                BuyerId = userId,
                SellerId = listing.UserId,
                OfferedPrice = request.OfferedPrice,
                Message = request.Message,
                Status = OfferStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };
            _db.MarketplaceOffers.Add(offer);
        }

        await _db.SaveChangesAsync();

        // Notify seller
        try
        {
            _db.Notifications.Add(new Notification
            {
                UserId = listing.UserId,
                Title = $"New Offer on {listing.Title}!",
                Body = $"{buyer?.FullName ?? "A buyer"} offered ₹{request.OfferedPrice:F0} for \"{listing.Title}\". Tap to review offer in Bazaar.",
                Type = "MARKETPLACE_OFFER",
                // ListingId (not offer.Id) so notification tap opens the listing/offers UI
                ReferenceId = listing.Id.ToString(),
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
        catch { }

        var dto = new OfferDto
        {
            Id = offer.Id,
            ListingId = listing.Id,
            ListingTitle = listing.Title,
            ListingPrice = listing.Price,
            ListingImageUrl = listing.Images.FirstOrDefault()?.ImageUrl,
            BuyerId = userId,
            BuyerName = buyer?.FullName ?? "Buyer",
            SellerId = listing.UserId,
            SellerName = listing.User?.FullName ?? "Seller",
            OfferedPrice = offer.OfferedPrice,
            Message = offer.Message,
            Status = offer.Status,
            CreatedAt = offer.CreatedAt
        };

        return Ok(ApiResponse<OfferDto>.Ok(dto, "Offer submitted successfully"));
    }

    /// <summary>
    /// Get offers on a specific listing (owner or admin only)
    /// </summary>
    [HttpGet("listings/{id:long}/offers")]
    public async Task<ActionResult<ApiResponse<List<OfferDto>>>> GetListingOffers(long id)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<List<OfferDto>>.Fail("Authentication required"));

        var listing = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == id && l.IsActive);
        if (listing == null)
            return NotFound(ApiResponse<List<OfferDto>>.Fail("Listing not found"));

        if (listing.UserId != currentUserId.Value && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        var offers = await _db.MarketplaceOffers
            .Include(o => o.Listing)
            .Include(o => o.Buyer)
            .Include(o => o.Seller)
            .Where(o => o.ListingId == id)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OfferDto
            {
                Id = o.Id,
                ListingId = o.ListingId,
                ListingTitle = o.Listing.Title,
                ListingPrice = o.Listing.Price,
                BuyerId = o.BuyerId,
                BuyerName = o.Buyer.FullName ?? "Buyer",
                SellerId = o.SellerId,
                SellerName = o.Seller.FullName ?? "Seller",
                OfferedPrice = o.OfferedPrice,
                Message = o.Message,
                Status = o.Status,
                CreatedAt = o.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<OfferDto>>.Ok(offers));
    }

    /// <summary>
    /// Get offers sent or received by current user
    /// </summary>
    [HttpGet("my-offers")]
    public async Task<ActionResult<ApiResponse<List<OfferDto>>>> GetMyOffers()
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<List<OfferDto>>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        var offers = await _db.MarketplaceOffers
            .Include(o => o.Listing).ThenInclude(l => l.Images)
            .Include(o => o.Buyer)
            .Include(o => o.Seller)
            .Where(o => o.BuyerId == userId || o.SellerId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OfferDto
            {
                Id = o.Id,
                ListingId = o.ListingId,
                ListingTitle = o.Listing.Title,
                ListingPrice = o.Listing.Price,
                ListingImageUrl = o.Listing.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                BuyerId = o.BuyerId,
                BuyerName = o.Buyer.FullName ?? "Buyer",
                SellerId = o.SellerId,
                SellerName = o.Seller.FullName ?? "Seller",
                OfferedPrice = o.OfferedPrice,
                Message = o.Message,
                Status = o.Status,
                CreatedAt = o.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<OfferDto>>.Ok(offers));
    }

    /// <summary>
    /// Update offer status (ACCEPT or REJECT by seller, CANCEL by buyer)
    /// </summary>
    [HttpPut("offers/{id:long}/status")]
    public async Task<ActionResult<ApiResponse<OfferDto>>> UpdateOfferStatus(long id, [FromBody] UpdateOfferStatusRequest request)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<OfferDto>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        var offer = await _db.MarketplaceOffers
            .Include(o => o.Listing)
            .Include(o => o.Buyer)
            .Include(o => o.Seller)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (offer == null)
            return NotFound(ApiResponse<OfferDto>.Fail("Offer not found"));

        var status = request.Status?.Trim().ToUpperInvariant() ?? string.Empty;
        if (status != OfferStatus.Accepted && status != OfferStatus.Rejected && status != OfferStatus.Cancelled)
            return BadRequest(ApiResponse<OfferDto>.Fail("Invalid status. Supported: ACCEPTED, REJECTED, CANCELLED"));

        if (status == OfferStatus.Accepted || status == OfferStatus.Rejected)
        {
            if (offer.SellerId != userId && !User.IsInRole(RoleNames.Admin))
                return Forbid();

            offer.Status = status;
            offer.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            // Notify buyer
            try
            {
                _db.Notifications.Add(new Notification
                {
                    UserId = offer.BuyerId,
                    Title = status == OfferStatus.Accepted ? "Offer Accepted! 🎉" : "Offer Declined",
                    Body = $"Your offer of ₹{offer.OfferedPrice:F0} for \"{offer.Listing?.Title}\" was {status.ToLower()} by the seller.",
                    Type = "MARKETPLACE_OFFER",
                    // ListingId so buyer tap opens the listing, not a fake conversation id
                    ReferenceId = offer.ListingId.ToString(),
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
                await _db.SaveChangesAsync();
            }
            catch { }
        }
        else if (status == OfferStatus.Cancelled)
        {
            if (offer.BuyerId != userId && !User.IsInRole(RoleNames.Admin))
                return Forbid();

            if (offer.Status != OfferStatus.Pending)
                return BadRequest(ApiResponse<OfferDto>.Fail("Only PENDING offers can be cancelled"));

            offer.Status = OfferStatus.Cancelled;
            offer.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<OfferDto>.Ok(new OfferDto
        {
            Id = offer.Id,
            ListingId = offer.ListingId,
            ListingTitle = offer.Listing?.Title ?? "Listing",
            ListingPrice = offer.Listing?.Price ?? 0,
            BuyerId = offer.BuyerId,
            BuyerName = offer.Buyer?.FullName ?? "Buyer",
            SellerId = offer.SellerId,
            SellerName = offer.Seller?.FullName ?? "Seller",
            OfferedPrice = offer.OfferedPrice,
            Message = offer.Message,
            Status = offer.Status,
            CreatedAt = offer.CreatedAt
        }, $"Offer status updated to {offer.Status}"));
    }

    /// <summary>
    /// Report a listing for moderation. Requires auth. Never auto-removes the listing.
    /// Serious reasons mark the listing FLAGGED for admin review while keeping it active.
    /// </summary>
    [HttpPost("listings/{id:long}/report")]
    public async Task<ActionResult<ApiResponse>> ReportListing(long id, [FromBody] ReportListingRequest request)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required to report a listing"));

        var listing = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null)
            return NotFound(ApiResponse.Fail("Listing not found"));

        if (listing.UserId == currentUserId.Value)
            return BadRequest(ApiResponse.Fail("You cannot report your own listing"));

        if (string.IsNullOrWhiteSpace(request?.Reason))
            return BadRequest(ApiResponse.Fail("Reason is required to report a listing"));

        var reason = request.Reason.Trim().ToUpperInvariant();
        var isSerious =
            reason is "SPAM" or "OFFENSIVE" or "FRAUD";

        // Queue for moderation only — reporters must not be able to take listings offline.
        if (isSerious && listing.Status != ListingStatus.Removed && listing.Status != ListingStatus.Sold)
        {
            listing.Status = ListingStatus.Flagged;
            listing.UpdatedAt = DateTime.UtcNow;
            // Keep IsActive true so the listing stays discoverable until an admin decides.
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Listing reported successfully. Our moderation team will review it shortly."));
    }

    // --- Chat Endpoints ---

    /// <summary>
    /// Open or get conversation for a listing between buyer (current user) and seller
    /// </summary>
    [HttpPost("listings/{id:long}/chat")]
    public async Task<ActionResult<ApiResponse<ChatConversationDto>>> OpenChat(long id)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<ChatConversationDto>.Fail("Authentication required"));

        var buyerId = currentUserId.Value;

        var listing = await _db.MarketplaceListings
            .Include(l => l.User)
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == id && l.IsActive);

        if (listing == null)
            return NotFound(ApiResponse<ChatConversationDto>.Fail("Listing not found"));

        if (listing.UserId == buyerId)
            return BadRequest(ApiResponse<ChatConversationDto>.Fail("You cannot start a chat with yourself"));

        var conv = await _db.ChatConversations
            .Include(c => c.Listing)
                .ThenInclude(l => l.Images)
            .Include(c => c.Buyer)
            .Include(c => c.Seller)
            .Include(c => c.Messages)
                .ThenInclude(m => m.Sender)
            .FirstOrDefaultAsync(c => c.ListingId == id && c.BuyerId == buyerId);

        if (conv == null)
        {
            conv = new ChatConversation
            {
                ListingId = listing.Id,
                BuyerId = buyerId,
                SellerId = listing.UserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.ChatConversations.Add(conv);
            await _db.SaveChangesAsync();

            // Re-fetch with includes
            conv = await _db.ChatConversations
                .Include(c => c.Listing)
                    .ThenInclude(l => l.Images)
                .Include(c => c.Buyer)
                .Include(c => c.Seller)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .FirstAsync(c => c.Id == conv.Id);
        }

        var dto = MapToConversationDto(conv);
        return Ok(ApiResponse<ChatConversationDto>.Ok(dto));
    }

    /// <summary>
    /// Get chat conversation by conversation ID with history
    /// </summary>
    [HttpGet("conversations/{id:long}")]
    public async Task<ActionResult<ApiResponse<ChatConversationDto>>> GetConversation(long id)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<ChatConversationDto>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        var conv = await _db.ChatConversations
            .Include(c => c.Listing)
                .ThenInclude(l => l.Images)
            .Include(c => c.Buyer)
            .Include(c => c.Seller)
            .Include(c => c.Messages)
                .ThenInclude(m => m.Sender)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conv == null)
            return NotFound(ApiResponse<ChatConversationDto>.Fail("Conversation not found"));

        if (conv.BuyerId != userId && conv.SellerId != userId && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        var dto = MapToConversationDto(conv);
        return Ok(ApiResponse<ChatConversationDto>.Ok(dto));
    }

    /// <summary>
    /// Send message in a chat conversation
    /// </summary>
    [HttpPost("conversations/{id:long}/messages")]
    public async Task<ActionResult<ApiResponse<ChatMessageDto>>> SendMessage(long id, [FromBody] SendChatMessageRequest request)
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<ChatMessageDto>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        if (string.IsNullOrWhiteSpace(request?.MessageText))
            return BadRequest(ApiResponse<ChatMessageDto>.Fail("Message cannot be empty"));

        var conv = await _db.ChatConversations
            .Include(c => c.Listing)
            .Include(c => c.Buyer)
            .Include(c => c.Seller)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conv == null)
            return NotFound(ApiResponse<ChatMessageDto>.Fail("Conversation not found"));

        if (conv.BuyerId != userId && conv.SellerId != userId && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        var sender = await _db.Users.FindAsync(userId);
        if (sender == null)
            return Unauthorized(ApiResponse<ChatMessageDto>.Fail("User not found"));

        var trimmedText = request.MessageText.Trim();
        var clientMsgId = !string.IsNullOrWhiteSpace(request.ClientMessageId) ? request.ClientMessageId.Trim() : null;

        // Idempotency check:
        // 1. If ClientMessageId is provided, check if a message with this unique key was already saved
        // 2. Otherwise fallback to sliding 5-second identical text check for rapid accidental double-taps
        ChatMessage? existingMsg = null;
        if (!string.IsNullOrEmpty(clientMsgId))
        {
            existingMsg = await _db.ChatMessages
                .FirstOrDefaultAsync(m => m.ConversationId == conv.Id && m.ClientMessageId == clientMsgId);
        }

        if (existingMsg == null && string.IsNullOrEmpty(clientMsgId))
        {
            var recentCutoff = DateTime.UtcNow.AddSeconds(-3);
            existingMsg = await _db.ChatMessages
                .Where(m => m.ConversationId == conv.Id && m.SenderId == userId && m.MessageText == trimmedText && m.CreatedAt >= recentCutoff)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();
        }

        ChatMessage msg;
        bool isNewMessage = false;

        if (existingMsg != null)
        {
            msg = existingMsg;
        }
        else
        {
            isNewMessage = true;
            msg = new ChatMessage
            {
                ConversationId = conv.Id,
                SenderId = userId,
                MessageText = trimmedText,
                ClientMessageId = clientMsgId,
                CreatedAt = DateTime.UtcNow
            };

            _db.ChatMessages.Add(msg);
            conv.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        var messageDto = new ChatMessageDto
        {
            Id = msg.Id,
            ConversationId = msg.ConversationId,
            SenderId = msg.SenderId,
            SenderName = sender.FullName ?? "User",
            MessageText = msg.MessageText,
            CreatedAt = msg.CreatedAt,
            ClientMessageId = request.ClientMessageId
        };

        if (isNewMessage)
        {
            // Broadcast to SignalR group
            if (_chatHub != null)
            {
                try
                {
                    await _chatHub.Clients.Group($"chat-{id}").SendAsync("MessageReceived", new
                    {
                        id = messageDto.Id,
                        conversationId = id.ToString(),
                        senderId = messageDto.SenderId,
                        senderName = messageDto.SenderName,
                        messageText = messageDto.MessageText,
                        timestamp = messageDto.CreatedAt,
                        clientMessageId = messageDto.ClientMessageId
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SignalR Chat Broadcast Error] {ex.Message}");
                }
            }

            // Dispatch notification to recipient (the other participant in the conversation)
            var recipientId = (conv.BuyerId == userId) ? conv.SellerId : conv.BuyerId;
            if (recipientId != userId)
            {
                var senderDisplayName = !string.IsNullOrWhiteSpace(sender.FullName) ? sender.FullName : "Someone";
                var listingName = conv.Listing?.Title ?? "your marketplace item";
                var notifTitle = $"New message from {senderDisplayName}";
                var preview = messageDto.MessageText.Length > 60
                    ? messageDto.MessageText.Substring(0, 57) + "..."
                    : messageDto.MessageText;
                var notifBody = $"Re: {listingName}\n\"{preview}\"";

                if (_notificationService != null)
                {
                    try
                    {
                        await _notificationService.SendPushNotificationAsync(
                            recipientId,
                            notifTitle,
                            notifBody,
                            "MARKETPLACE_CHAT",
                            id.ToString());
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[Marketplace Chat Push Notification Error] {ex.Message}");
                    }
                }
                else
                {
                    // Direct in-app notification persistence fallback if notification service is not registered
                    try
                    {
                        _db.Notifications.Add(new Notification
                        {
                            UserId = recipientId,
                            Title = notifTitle,
                            Body = notifBody,
                            Type = "MARKETPLACE_CHAT",
                            ReferenceId = id.ToString(),
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });
                        await _db.SaveChangesAsync();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[Marketplace Chat In-App Notification Error] {ex.Message}");
                    }
                }
            }
        }

        return Ok(ApiResponse<ChatMessageDto>.Ok(messageDto));
    }

    /// <summary>
    /// List conversations for current user
    /// </summary>
    [HttpGet("conversations")]
    public async Task<ActionResult<ApiResponse<List<ChatConversationDto>>>> GetMyConversations()
    {
        var currentUserId = GetCurrentUserId();
        if (!currentUserId.HasValue)
            return Unauthorized(ApiResponse<List<ChatConversationDto>>.Fail("Authentication required"));

        var userId = currentUserId.Value;

        var convs = await _db.ChatConversations
            .Include(c => c.Listing)
                .ThenInclude(l => l.Images)
            .Include(c => c.Buyer)
            .Include(c => c.Seller)
            .Include(c => c.Messages)
                .ThenInclude(m => m.Sender)
            .Where(c => c.BuyerId == userId || c.SellerId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync();

        var dtos = convs.Select(MapToConversationDto).ToList();
        return Ok(ApiResponse<List<ChatConversationDto>>.Ok(dtos));
    }

    private static ChatConversationDto MapToConversationDto(ChatConversation conv)
    {
        var sortedMessages = conv.Messages.OrderBy(m => m.CreatedAt).ToList();
        var lastMsg = sortedMessages.LastOrDefault();
        var primaryImage = conv.Listing?.Images?.OrderBy(i => i.SortOrder).FirstOrDefault()?.ImageUrl;

        return new ChatConversationDto
        {
            Id = conv.Id,
            ListingId = conv.ListingId,
            ListingTitle = conv.Listing?.Title ?? "Listing",
            ListingPrice = conv.Listing?.Price ?? 0,
            ListingImageUrl = primaryImage,
            BuyerId = conv.BuyerId,
            BuyerName = conv.Buyer?.FullName ?? "Buyer",
            SellerId = conv.SellerId,
            SellerName = conv.Seller?.FullName ?? "Seller",
            LastMessageText = lastMsg?.MessageText,
            LastMessageTimestamp = lastMsg?.CreatedAt,
            CreatedAt = conv.CreatedAt,
            Messages = sortedMessages.Select(m => new ChatMessageDto
            {
                Id = m.Id,
                ConversationId = m.ConversationId,
                SenderId = m.SenderId,
                SenderName = m.Sender?.FullName ?? "User",
                MessageText = m.MessageText,
                CreatedAt = m.CreatedAt
            }).ToList()
        };
    }

}