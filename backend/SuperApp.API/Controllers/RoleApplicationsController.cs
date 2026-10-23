using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/role-applications")]
[Authorize]
public class RoleApplicationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RoleApplicationService _apps;

    public RoleApplicationsController(AppDbContext db, RoleApplicationService apps)
    {
        _db = db;
        _apps = apps;
    }

    private long? GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return long.TryParse(claim, out var id) ? id : null;
    }

    /// <summary>Citizen submits DRIVER or RESTAURANT_OWNER application with mandatory docs.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<RoleApplicationDto>>> Submit([FromBody] SubmitRoleApplicationRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse<RoleApplicationDto>.Fail("Unauthorized"));

        var (app, error) = await _apps.SubmitAsync(userId.Value, request);
        if (error != null || app == null)
            return BadRequest(ApiResponse<RoleApplicationDto>.Fail(error ?? "Could not submit application"));

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value);
        return Ok(ApiResponse<RoleApplicationDto>.Ok(RoleApplicationService.ToDto(app, user), "Application submitted for admin review"));
    }

    /// <summary>List my role applications.</summary>
    [HttpGet("mine")]
    public async Task<ActionResult<ApiResponse<List<RoleApplicationDto>>>> Mine()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse<List<RoleApplicationDto>>.Fail("Unauthorized"));

        await _apps.EnsureCitizenRoleAsync(userId.Value);

        var list = await _db.RoleApplications.AsNoTracking()
            .Where(a => a.UserId == userId.Value)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return Ok(ApiResponse<List<RoleApplicationDto>>.Ok(list.Select(a => RoleApplicationService.ToDto(a)).ToList()));
    }

    /// <summary>Cancel my pending application.</summary>
    [HttpPost("{id:long}/cancel")]
    public async Task<ActionResult<ApiResponse>> Cancel(long id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(ApiResponse.Fail("Unauthorized"));

        var app = await _db.RoleApplications.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId.Value);
        if (app == null) return NotFound(ApiResponse.Fail("Application not found"));
        if (app.Status != RoleApplicationStatuses.Pending)
            return BadRequest(ApiResponse.Fail($"Only PENDING applications can be cancelled (current: {app.Status})"));

        app.Status = RoleApplicationStatuses.Cancelled;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("Application cancelled"));
    }
}
