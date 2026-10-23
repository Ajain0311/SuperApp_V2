using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RestaurantsController : ControllerBase
{
    private readonly AppDbContext _db;

    public RestaurantsController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// List restaurants with optional search, veg filter, city filter, and pagination
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<RestaurantSummaryDto>>>> GetRestaurants(
        [FromQuery] string? search,
        [FromQuery] bool? isVegOnly,
        [FromQuery] string? city,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Restaurants.Where(r => r.IsActive).AsQueryable();

        if (!string.IsNullOrWhiteSpace(city))
        {
            query = query.Where(r => r.City != null && r.City.Contains(city));
        }

        if (isVegOnly == true)
        {
            query = query.Where(r => r.IsVeg);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r => r.Name.Contains(term) ||
                                     (r.Description != null && r.Description.Contains(term)) ||
                                     r.FoodItems.Any(f => f.Name.Contains(term)));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.IsFeatured)
            .ThenByDescending(r => r.Rating)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RestaurantSummaryDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                ImageUrl = r.ImageUrl,
                AddressLine = r.AddressLine,
                City = r.City,
                Rating = r.Rating,
                TotalRatings = r.TotalRatings,
                IsVeg = r.IsVeg,
                MinOrderAmount = r.MinOrderAmount,
                DeliveryFee = r.DeliveryFee,
                AvgDeliveryTimeMinutes = r.AvgDeliveryTimeMinutes,
                IsFeatured = r.IsFeatured,
                Phone = r.Phone,
                Cuisines = r.Description,
                OfferText = r.DeliveryFee == 0 ? "FREE DELIVERY" : "60% OFF UPTO ₹120"
            })
            .ToListAsync();

        return Ok(ApiResponse<PagedResult<RestaurantSummaryDto>>.Ok(new PagedResult<RestaurantSummaryDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        }));
    }

    /// <summary>
    /// Cross-restaurant foods feed (direct dishes — hotel-first browse alternative).
    /// Must be declared before {id:long} so "foods" is not parsed as an id.
    /// </summary>
    [HttpGet("foods")]
    public async Task<ActionResult<ApiResponse<PagedResult<FoodCatalogItemDto>>>> GetFoods(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] bool? isVegOnly,
        [FromQuery] bool? isBestseller,
        [FromQuery] long? restaurantId,
        [FromQuery] string? city,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 50) pageSize = 50;

        var query = _db.FoodItems
            .AsNoTracking()
            .Include(f => f.Restaurant)
            .Include(f => f.RestaurantCategory)
            .Where(f => f.IsActive && f.IsAvailable && f.Restaurant != null && f.Restaurant.IsActive);

        if (restaurantId.HasValue && restaurantId.Value > 0)
            query = query.Where(f => f.RestaurantId == restaurantId.Value);

        if (isVegOnly == true)
            query = query.Where(f => f.IsVeg);

        if (isBestseller == true)
            query = query.Where(f => f.IsBestseller);

        if (!string.IsNullOrWhiteSpace(city))
        {
            var cityTerm = city.Trim();
            query = query.Where(f => f.Restaurant!.City != null && f.Restaurant.City.Contains(cityTerm));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var cat = category.Trim().ToLower();
            query = query.Where(f =>
                (f.RestaurantCategory != null && f.RestaurantCategory.Name.ToLower().Contains(cat)) ||
                f.Name.ToLower().Contains(cat) ||
                (f.Description != null && f.Description.ToLower().Contains(cat)) ||
                (f.Restaurant!.Description != null && f.Restaurant.Description.ToLower().Contains(cat)));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(f =>
                f.Name.Contains(term) ||
                (f.Description != null && f.Description.Contains(term)) ||
                f.Restaurant!.Name.Contains(term) ||
                (f.RestaurantCategory != null && f.RestaurantCategory.Name.Contains(term)));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(f => f.IsBestseller)
            .ThenByDescending(f => f.Restaurant!.Rating)
            .ThenBy(f => f.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FoodCatalogItemDto
            {
                Id = f.Id,
                Name = f.Name,
                Description = f.Description,
                ImageUrl = f.ImageUrl,
                BasePrice = f.BasePrice,
                DiscountPercent = f.DiscountPercent,
                DiscountedPrice = f.DiscountPercent > 0
                    ? Math.Round(f.BasePrice * (1 - f.DiscountPercent / 100m), 2)
                    : f.BasePrice,
                IsVeg = f.IsVeg,
                IsAvailable = f.IsAvailable,
                IsBestseller = f.IsBestseller,
                IsCustomizable = f.IsCustomizable,
                RestaurantId = f.RestaurantId,
                RestaurantName = f.Restaurant!.Name,
                RestaurantImageUrl = f.Restaurant.ImageUrl,
                RestaurantRating = f.Restaurant.Rating,
                AvgDeliveryTimeMinutes = f.Restaurant.AvgDeliveryTimeMinutes,
                CategoryName = f.RestaurantCategory != null ? f.RestaurantCategory.Name : null,
                Cuisines = f.Restaurant.Description
            })
            .ToListAsync();

        return Ok(ApiResponse<PagedResult<FoodCatalogItemDto>>.Ok(new PagedResult<FoodCatalogItemDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        }));
    }

    /// <summary>
    /// Get restaurant detail with categories, food items, variants, and add-ons
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<RestaurantDetailDto>>> GetRestaurant(long id)
    {
        var restaurant = await _db.Restaurants
            .Include(r => r.Categories.Where(c => c.IsActive).OrderBy(c => c.SortOrder))
                .ThenInclude(c => c.FoodItems.Where(f => f.IsActive).OrderBy(f => f.SortOrder))
                    .ThenInclude(f => f.Variants.Where(v => v.IsActive).OrderBy(v => v.SortOrder))
            .Include(r => r.Categories)
                .ThenInclude(c => c.FoodItems)
                    .ThenInclude(f => f.Addons.Where(a => a.IsActive).OrderBy(a => a.SortOrder))
            .FirstOrDefaultAsync(r => r.Id == id && r.IsActive);

        if (restaurant == null)
            return NotFound(ApiResponse<RestaurantDetailDto>.Fail("Restaurant not found"));

        var detail = new RestaurantDetailDto
        {
            Id = restaurant.Id,
            Name = restaurant.Name,
            Description = restaurant.Description,
            ImageUrl = restaurant.ImageUrl,
            AddressLine = restaurant.AddressLine,
            City = restaurant.City,
            Rating = restaurant.Rating,
            TotalRatings = restaurant.TotalRatings,
            IsVeg = restaurant.IsVeg,
            MinOrderAmount = restaurant.MinOrderAmount,
            DeliveryFee = restaurant.DeliveryFee,
            AvgDeliveryTimeMinutes = restaurant.AvgDeliveryTimeMinutes,
            IsFeatured = restaurant.IsFeatured,
            Phone = restaurant.Phone,
            OpeningTime = restaurant.OpeningTime,
            ClosingTime = restaurant.ClosingTime,
            Categories = restaurant.Categories.Select(c => new RestaurantCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                SortOrder = c.SortOrder,
                Items = c.FoodItems.Select(f => new FoodItemDto
                {
                    Id = f.Id,
                    RestaurantId = f.RestaurantId,
                    RestaurantCategoryId = f.RestaurantCategoryId,
                    Name = f.Name,
                    Description = f.Description,
                    ImageUrl = f.ImageUrl,
                    BasePrice = f.BasePrice,
                    DiscountPercent = f.DiscountPercent,
                    DiscountedPrice = f.DiscountedPrice,
                    IsVeg = f.IsVeg,
                    IsAvailable = f.IsAvailable,
                    IsBestseller = f.IsBestseller,
                    IsCustomizable = f.IsCustomizable,
                    Variants = f.Variants.Select(v => new FoodItemVariantDto
                    {
                        Id = v.Id,
                        Name = v.Name,
                        AdditionalPrice = v.AdditionalPrice,
                        IsDefault = v.IsDefault
                    }).ToList(),
                    Addons = f.Addons.Select(a => new FoodItemAddonDto
                    {
                        Id = a.Id,
                        GroupName = a.GroupName,
                        Name = a.Name,
                        Price = a.Price,
                        IsDefault = a.IsDefault
                    }).ToList()
                }).ToList()
            }).ToList()
        };

        return Ok(ApiResponse<RestaurantDetailDto>.Ok(detail));
    }
}
