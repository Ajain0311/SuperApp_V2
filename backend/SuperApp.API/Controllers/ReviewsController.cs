using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ReviewsController(AppDbContext db)
    {
        _db = db;
    }

    private long GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id))
            return id;
        return 1;
    }

    /// <summary>
    /// Submit a rating and review for a restaurant, driver, or marketplace listing
    /// </summary>
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<ReviewDto>>> SubmitReview([FromBody] CreateReviewRequest request)
    {
        if (request.Rating < 1 || request.Rating > 5)
            return BadRequest(ApiResponse<ReviewDto>.Fail("Rating must be between 1 and 5 stars"));

        var targetType = request.TargetType?.Trim().ToUpperInvariant() ?? string.Empty;
        var validTypes = new[] { "RESTAURANT", "DRIVER", "LISTING" };
        if (!validTypes.Contains(targetType))
            return BadRequest(ApiResponse<ReviewDto>.Fail("TargetType must be RESTAURANT, DRIVER, or LISTING"));

        var userId = GetCurrentUserId();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null)
            return Unauthorized(ApiResponse<ReviewDto>.Fail("User session invalid"));

        // Verify target existence
        if (targetType == "RESTAURANT")
        {
            var restaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.Id == request.TargetId && r.IsActive);
            if (restaurant == null)
                return NotFound(ApiResponse<ReviewDto>.Fail("Restaurant not found"));
        }
        else if (targetType == "DRIVER")
        {
            var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.Id == request.TargetId && d.IsActive);
            if (driver == null)
                return NotFound(ApiResponse<ReviewDto>.Fail("Driver not found"));
        }
        else if (targetType == "LISTING")
        {
            var listing = await _db.MarketplaceListings.FirstOrDefaultAsync(l => l.Id == request.TargetId && l.IsActive);
            if (listing == null)
                return NotFound(ApiResponse<ReviewDto>.Fail("Marketplace listing not found"));
        }

        var review = new Review
        {
            UserId = userId,
            TargetType = targetType,
            TargetId = request.TargetId,
            Rating = request.Rating,
            Comment = request.Comment?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Reviews.Add(review);
        await _db.SaveChangesAsync();

        // Update target aggregate rating
        if (targetType == "RESTAURANT")
        {
            var avg = await _db.Reviews
                .Where(r => r.TargetType == "RESTAURANT" && r.TargetId == request.TargetId)
                .AverageAsync(r => (double)r.Rating);
            var count = await _db.Reviews
                .CountAsync(r => r.TargetType == "RESTAURANT" && r.TargetId == request.TargetId);

            var rest = await _db.Restaurants.FindAsync(request.TargetId);
            if (rest != null)
            {
                rest.Rating = Math.Round((decimal)avg, 1);
                rest.TotalRatings = count;
                await _db.SaveChangesAsync();
            }
        }
        else if (targetType == "DRIVER")
        {
            var avg = await _db.Reviews
                .Where(r => r.TargetType == "DRIVER" && r.TargetId == request.TargetId)
                .AverageAsync(r => (double)r.Rating);

            var driver = await _db.Drivers.FindAsync(request.TargetId);
            if (driver != null)
            {
                driver.Rating = Math.Round((decimal)avg, 2);
                await _db.SaveChangesAsync();
            }
        }

        var dto = new ReviewDto
        {
            Id = review.Id,
            UserId = userId,
            UserName = user.FullName ?? "User",
            UserAvatar = user.ProfileImageUrl,
            TargetType = review.TargetType,
            TargetId = review.TargetId,
            Rating = review.Rating,
            Comment = review.Comment,
            CreatedAt = review.CreatedAt
        };

        return Ok(ApiResponse<ReviewDto>.Ok(dto, "Review submitted successfully"));
    }

    /// <summary>
    /// Get ratings and reviews for a target entity
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ReviewDto>>>> GetReviews(
        [FromQuery] string targetType,
        [FromQuery] long targetId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var normalizedType = targetType?.Trim().ToUpperInvariant() ?? string.Empty;

        var reviews = await _db.Reviews
            .Include(r => r.User)
            .Where(r => r.TargetType == normalizedType && r.TargetId == targetId)
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new ReviewDto
            {
                Id = r.Id,
                UserId = r.UserId,
                UserName = r.User.FullName ?? "User",
                UserAvatar = r.User.ProfileImageUrl,
                TargetType = r.TargetType,
                TargetId = r.TargetId,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<ReviewDto>>.Ok(reviews));
    }
}
