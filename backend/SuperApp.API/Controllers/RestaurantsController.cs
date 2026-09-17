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
