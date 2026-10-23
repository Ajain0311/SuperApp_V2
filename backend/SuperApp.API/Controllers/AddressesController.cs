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

    private static string? PinValidationMessage(UpsertAddressRequest? request)
    {
        var pin = request?.PinCode?.Trim();
        if (string.IsNullOrEmpty(pin)) return null;
        if (pin.Length != 6 || !pin.All(char.IsDigit))
            return "PIN code must be exactly 6 digits";
        return null;
    }

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
            return BadRequest(ApiResponse<AddressDto>.Fail(PinValidationMessage(request) ?? "Please fill address, city, state and PIN"));

        var userId = TryGetUserId();
        if (userId == null)
            return Unauthorized(ApiResponse<AddressDto>.Fail("Please log in to save an address"));

        var hasAny = await _db.Addresses.AnyAsync(a => a.UserId == userId && a.IsActive);
        var makeDefault = request.IsDefault || !hasAny;

        if (makeDefault)
        {
            await ClearDefaultsAsync(userId.Value);
        }

        if (!TryNormalizeCoordinates(request.Latitude, request.Longitude, out var lat, out var lng, out var coordError))
            return BadRequest(ApiResponse<AddressDto>.Fail(coordError ?? "Invalid coordinates"));

        var address = new Address
        {
            UserId = userId.Value,
            Label = string.IsNullOrWhiteSpace(request.Label) ? "Home" : request.Label.Trim(),
            AddressLine1 = request.AddressLine1.Trim(),
            AddressLine2 = string.IsNullOrWhiteSpace(request.AddressLine2) ? null : request.AddressLine2.Trim(),
            City = request.City.Trim(),
            State = request.State.Trim(),
            PinCode = request.PinCode.Trim(),
            Latitude = lat,
            Longitude = lng,
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
            return BadRequest(ApiResponse<AddressDto>.Fail(PinValidationMessage(request) ?? "Please fill address, city, state and PIN"));

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
        // Never wipe existing map pins: only overwrite when the client sends real coordinates.
        if (!TryNormalizeCoordinates(request.Latitude, request.Longitude, out var lat, out var lng, out var coordError))
            return BadRequest(ApiResponse<AddressDto>.Fail(coordError ?? "Invalid coordinates"));
        if (lat.HasValue && lng.HasValue)
        {
            address.Latitude = lat;
            address.Longitude = lng;
        }
        address.UpdatedAt = DateTime.UtcNow;

        if (request.IsDefault)
        {
            await ClearDefaultsAsync(userId.Value, address.Id);
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

        var address = await _db.Addresses.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId && a.IsActive);
        if (address == null)
            return NotFound(ApiResponse<AddressDto>.Fail("Address not found"));

        // Atomic single-default: clear+set in one pass so concurrent SetDefault
        // cannot leave multiple IsDefault=true (TOCTOU on ClearDefaults-then-set).
        await ApplySingleDefaultAsync(userId.Value, id);

        address.IsDefault = true;
        address.UpdatedAt = DateTime.UtcNow;
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

        var wasDefault = address.IsDefault;
        address.IsActive = false;
        address.IsDefault = false;
        address.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (wasDefault)
        {
            var nextId = await _db.Addresses
                .Where(a => a.UserId == userId && a.IsActive)
                .OrderByDescending(a => a.UpdatedAt ?? a.CreatedAt)
                .Select(a => (long?)a.Id)
                .FirstOrDefaultAsync();
            if (nextId != null)
            {
                if (_db.Database.IsInMemory())
                {
                    var nextTarget = await _db.Addresses.FirstOrDefaultAsync(a => a.Id == nextId.Value);
                    if (nextTarget != null)
                    {
                        nextTarget.IsDefault = true;
                        nextTarget.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                    }
                }
                else
                {
                    await _db.Addresses
                        .Where(a => a.Id == nextId.Value)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(a => a.IsDefault, true)
                            .SetProperty(a => a.UpdatedAt, DateTime.UtcNow));
                }
            }
        }

        return Ok(ApiResponse.Ok("Address removed"));
    }

    /// <summary>
    /// Clears other default flags with a column-scoped SQL update so latitude/longitude
    /// and other address fields cannot be accidentally overwritten by change-tracking.
    /// </summary>
    private async Task ClearDefaultsAsync(long userId, long? exceptId = null)
    {
        if (_db.Database.IsInMemory())
        {
            var defaults = await _db.Addresses
                .Where(a => a.UserId == userId && a.IsActive && a.IsDefault && (exceptId == null || a.Id != exceptId))
                .ToListAsync();
            foreach (var d in defaults)
            {
                d.IsDefault = false;
            }
            await _db.SaveChangesAsync();
        }
        else
        {
            await _db.Addresses
                .Where(a => a.UserId == userId && a.IsActive && a.IsDefault && (exceptId == null || a.Id != exceptId))
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsDefault, false));
        }
    }

    /// <summary>
    /// Force exactly one default among the user's active addresses.
    /// Sets IsDefault = (Id == targetId) for every active row in one update.
    /// </summary>
    private async Task ApplySingleDefaultAsync(long userId, long targetId)
    {
        var now = DateTime.UtcNow;
        if (_db.Database.IsInMemory())
        {
            var rows = await _db.Addresses
                .Where(a => a.UserId == userId && a.IsActive)
                .ToListAsync();
            foreach (var row in rows)
            {
                row.IsDefault = row.Id == targetId;
                row.UpdatedAt = now;
            }
            await _db.SaveChangesAsync();
            return;
        }

        await _db.Addresses
            .Where(a => a.UserId == userId && a.IsActive)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.IsDefault, a => a.Id == targetId)
                .SetProperty(a => a.UpdatedAt, now));
    }

    /// <summary>
    /// Validates optional map pins. Out-of-range values are rejected (400), not silently dropped.
    /// Exact (0,0) is treated as unset. Omitting both is fine.
    /// </summary>
    private static bool TryNormalizeCoordinates(
        decimal? latitude,
        decimal? longitude,
        out decimal? lat,
        out decimal? lng,
        out string? error)
    {
        lat = null;
        lng = null;
        error = null;

        if (!latitude.HasValue && !longitude.HasValue)
            return true;

        if (!latitude.HasValue || !longitude.HasValue)
        {
            error = "Both latitude and longitude are required together";
            return false;
        }

        var latVal = latitude.Value;
        var lngVal = longitude.Value;
        if (latVal is < -90m or > 90m || lngVal is < -180m or > 180m)
        {
            error = "Latitude must be between -90 and 90, longitude between -180 and 180";
            return false;
        }

        // Treat exact 0,0 as unset (common client placeholder / cleared pin).
        if (latVal == 0m && lngVal == 0m)
            return true;

        lat = latVal;
        lng = lngVal;
        return true;
    }
}
