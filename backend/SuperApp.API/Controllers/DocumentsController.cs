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
[Route("api/documents")]
public class DocumentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DocumentsController(AppDbContext db)
    {
        _db = db;
    }

    private long? CurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        return claim != null && long.TryParse(claim.Value, out var id) ? id : null;
    }

    public static string? DocumentNoFromUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        const string marker = "/api/documents/";
        var index = url.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0) return null;
        var rest = url[(index + marker.Length)..];
        var slash = rest.IndexOf('/');
        var no = slash >= 0 ? rest[..slash] : rest;
        return string.IsNullOrWhiteSpace(no) ? null : no;
    }

    [Authorize]
    [HttpPost]
    [RequestSizeLimit(ImageByteProcessor.MaxUploadBytes)]
    public async Task<ActionResult<ApiResponse<DocumentCreatedDto>>> Upload(IFormFile? file, [FromQuery] string? assign)
    {
        var userId = CurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse<DocumentCreatedDto>.Fail("Authentication required"));
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<DocumentCreatedDto>.Fail("Choose an image file"));
        if (file.Length > ImageByteProcessor.MaxUploadBytes)
            return BadRequest(ApiResponse<DocumentCreatedDto>.Fail("Image is larger than 8 MB"));

        byte[] raw;
        await using (var stream = file.OpenReadStream())
        using (var buffer = new MemoryStream())
        {
            await stream.CopyToAsync(buffer);
            raw = buffer.ToArray();
        }

        byte[] compressed;
        try
        {
            compressed = ImageByteProcessor.Compress(raw);
        }
        catch (InvalidImageException ex)
        {
            return BadRequest(ApiResponse<DocumentCreatedDto>.Fail(ex.Message));
        }

        var safeName = Path.GetFileName(file.FileName);
        if (string.IsNullOrWhiteSpace(safeName)) safeName = "photo.jpg";
        safeName = safeName.Length > 240 ? safeName[..240] : safeName;

        var document = new AppDocument
        {
            DocumentNo = "DOC-" + Guid.NewGuid().ToString("N")[..16],
            DocumentName = safeName,
            BlobObject = compressed,
            OwnerUserId = userId.Value,
            CreatedAt = DateTime.UtcNow
        };
        _db.Documents.Add(document);
        if (string.Equals(assign, "profile", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
            if (user != null)
                user.ProfileImageUrl = $"/api/documents/{document.DocumentNo}/image";
        }
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<DocumentCreatedDto>.Ok(new DocumentCreatedDto
        {
            DocumentNo = document.DocumentNo,
            DocumentName = document.DocumentName,
            ImageUrl = $"/api/documents/{document.DocumentNo}/image",
            ByteSize = compressed.Length
        }));
    }

    [AllowAnonymous]
    [HttpGet("{documentNo}/image")]
    public async Task<IActionResult> Image(string documentNo)
    {
        var row = await _db.Documents.AsNoTracking()
            .Where(d => d.DocumentNo == documentNo)
            .Select(d => new { d.BlobObject })
            .FirstOrDefaultAsync();
        if (row == null)
            return NotFound();

        Response.Headers.CacheControl = "public,max-age=86400";
        return File(row.BlobObject, "image/jpeg");
    }

    [Authorize]
    [HttpDelete("{documentNo}")]
    public async Task<ActionResult<ApiResponse>> Delete(string documentNo)
    {
        var userId = CurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(ApiResponse.Fail("Authentication required"));

        var row = await _db.Documents.FirstOrDefaultAsync(d => d.DocumentNo == documentNo);
        if (row == null)
            return NotFound(ApiResponse.Fail("Image not found"));
        if (row.OwnerUserId != userId.Value && !User.IsInRole(RoleNames.Admin))
            return Forbid();

        _db.Documents.Remove(row);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("Image deleted"));
    }
}
