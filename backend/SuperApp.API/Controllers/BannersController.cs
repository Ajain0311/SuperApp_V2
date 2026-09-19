using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BannersController : ControllerBase
{
    private readonly AppDbContext _db;

    public BannersController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Get active promotional banners for the Customer Home screen feed.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Banner>>>> GetActiveBanners([FromQuery] string? module)
    {
        var query = _db.Banners.Where(b => b.IsActive);

        if (!string.IsNullOrWhiteSpace(module))
        {
            var mod = module.Trim().ToUpperInvariant();
            query = query.Where(b => b.Module == mod || b.Module == "ALL");
        }

        var banners = await query.OrderBy(b => b.SortOrder).ToListAsync();
        return Ok(ApiResponse<List<Banner>>.Ok(banners));
    }
}
