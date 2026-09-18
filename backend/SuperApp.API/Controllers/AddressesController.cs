using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AddressesController : ControllerBase
{
    private readonly AppDbContext _db;

    public AddressesController(AppDbContext db)
    {
        _db = db;
    }

    private long? TryGetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim != null && long.TryParse(claim.Value, out var id) && id > 0)
            return id;
        return null;
    }

    private AddressDto Map(Address a) => new()
    {
        Id = a.Id,
        Label = a.Label,
        AddressLine1 = a.AddressLine1,
        AddressLine2 = a.AddressLine2,
        City = a.City,
        State = a.State,
        PinCode = a.PinCode,
        Latitude = a.Latitude,
        Longitude = a.Longitude,
        IsDefault = a.IsDefault,
    };

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<AddressDto>>>> GetMine()
    {
        var userId = TryGetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<List<AddressDto>>.Fail("Please log in to manage addresses"));

        var rows = await _db.Addresses
            .Where(a => a.UserId == userId && a.IsActive)
            .OrderByDescending(a => a.IsDefault)
            .ThenByDescending(a => a.UpdatedAt ?? a.CreatedAt)
            .ToListAsync();

        return Ok(ApiResponse<List<AddressDto>>.Ok(rows.Select(Map).ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<AddressDto>>> Create([FromBody] UpsertAddressRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse<AddressDto>.Fail("Please fill address, city, state and PIN"));

        var userId = TryGetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<AddressDto>.Fail("Please log in to save an address"));

        var hasAny = await _db.Addresses.AnyAsync(a => a.UserId == userId && a.IsActive);
        var makeDefault = request.IsDefault || !hasAny;

        if (makeDefault)
        {
            await ClearDefaults(userId.Value);
        }

        var address = new Address
        {
            UserId = userId.Value,
            Label = string.IsNullOrWhiteSpace(request.Label) ? "Home" : request.Label.Trim(),
            AddressLine1 = request.AddressLine1.Trim(),
            AddressLine2 = string.IsNullOrWhiteSpace(request.AddressLine2) ? null : request.AddressLine2.Trim(),
            City = request.City.Trim(),
            State = request.State.Trim(),
            PinCode = request.PinCode.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            IsDefault = makeDefault,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };

        _db.Addresses.Add(address);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<AddressDto>.Ok(Map(address), "Address saved"));
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse<AddressDto>>> Update(long id, [FromBody] UpsertAddressRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse<AddressDto>.Fail("Please fill address, city, state and PIN"));

        var userId = TryGetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<AddressDto>.Fail("Please log in to update an address"));

        var address = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId && a.IsActive);
        if (address == null)
            return NotFound(ApiResponse<AddressDto>.Fail("Address not found"));

        address.Label = string.IsNullOrWhiteSpace(request.Label) ? address.Label : request.Label.Trim();
        address.AddressLine1 = request.AddressLine1.Trim();
        address.AddressLine2 = string.IsNullOrWhiteSpace(request.AddressLine2) ? null : request.AddressLine2.Trim();
        address.City = request.City.Trim();
        address.State = request.State.Trim();
        address.PinCode = request.PinCode.Trim();
        address.Latitude = request.Latitude ?? address.Latitude;
        address.Longitude = request.Longitude ?? address.Longitude;
        address.UpdatedAt = DateTime.UtcNow;

        if (request.IsDefault)
        {
            await ClearDefaults(userId.Value, address.Id);
            address.IsDefault = true;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<AddressDto>.Ok(Map(address), "Address updated"));
    }

    [HttpPut("{id:long}/default")]
    public async Task<ActionResult<ApiResponse<AddressDto>>> SetDefault(long id)
    {
        var userId = TryGetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<AddressDto>.Fail("Please log in"));

        var address = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId && a.IsActive);
        if (address == null)
            return NotFound(ApiResponse<AddressDto>.Fail("Address not found"));

        await ClearDefaults(userId.Value, address.Id);
        address.IsDefault = true;
        address.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<AddressDto>.Ok(Map(address), "Default address updated"));
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Delete(long id)
    {
        var userId = TryGetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse.Fail("Please log in"));

        var address = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId && a.IsActive);
        if (address == null)
            return NotFound(ApiResponse.Fail("Address not found"));

        address.IsActive = false;
        address.IsDefault = false;
        address.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var next = await _db.Addresses
            .Where(a => a.UserId == userId && a.IsActive)
            .OrderByDescending(a => a.UpdatedAt ?? a.CreatedAt)
            .FirstOrDefaultAsync();
        if (next != null)
        {
            next.IsDefault = true;
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse.Ok("Address removed"));
    }

    private async Task ClearDefaults(long userId, long? exceptId = null)
    {
        var current = await _db.Addresses
            .Where(a => a.UserId == userId && a.IsActive && a.IsDefault && (exceptId == null || a.Id != exceptId))
            .ToListAsync();
        foreach (var a in current)
            a.IsDefault = false;
    }
}
