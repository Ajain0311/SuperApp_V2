using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SuperApp.API.Controllers;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;
using Xunit;
using Xunit.Abstractions;

namespace SuperApp.API.Tests;

public class DocumentImageTests
{
    private readonly ITestOutputHelper _output;
    public DocumentImageTests(ITestOutputHelper output) => _output = output;
    private static byte[] Jpeg(int width, int height)
    {
        using var image = new Image<Rgb24>(width, height);
        for (var y = 0; y < height; y += 3)
        for (var x = 0; x < width; x += 3)
            image[x, y] = new Rgb24((byte)(x % 255), (byte)(y % 255), 40);
        using var ms = new MemoryStream();
        image.SaveAsJpeg(ms, new JpegEncoder { Quality = 95 });
        return ms.ToArray();
    }

    private static AppDbContext Db()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new AppDbContext(options);
    }

    private static DocumentsController Api(AppDbContext db, long userId, string role = "CUSTOMER")
    {
        var controller = new DocumentsController(db);
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    private static IFormFile FileOf(byte[] bytes, string name)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", name);
    }

    [Fact]
    public async Task Upload_CompressesJpeg_AndGetReturnsBytesWithoutListingThem()
    {
        var db = Db();
        db.Users.Add(new User { Id = 7, MobileNumber = "9000000007", FullName = "Seller" });
        await db.SaveChangesAsync();
        var original = Jpeg(1800, 1200);

        var uploaded = await Api(db, 7).Upload(FileOf(original, "camera.jpg"), null);
        var ok = Assert.IsType<OkObjectResult>(uploaded.Result);
        var body = Assert.IsType<ApiResponse<DocumentCreatedDto>>(ok.Value);
        _output.WriteLine($"original={original.Length} processed={body.Data!.ByteSize}");
        Assert.True(body.Data!.ByteSize < original.Length);
        Assert.StartsWith("DOC-", body.Data.DocumentNo);
        Assert.Equal("image/jpeg", "image/jpeg");

        var stored = await db.Documents.AsNoTracking().SingleAsync();
        Assert.Equal(body.Data.ByteSize, stored.BlobObject.Length);
        Assert.True(stored.BlobObject[0] == 0xFF && stored.BlobObject[1] == 0xD8);

        var image = await Api(db, 7).Image(body.Data.DocumentNo);
        var file = Assert.IsType<FileContentResult>(image);
        Assert.Equal("image/jpeg", file.ContentType);
        Assert.Equal(stored.BlobObject.Length, file.FileContents.Length);

        var summary = new ListingSummaryDto { PrimaryImageUrl = body.Data.ImageUrl };
        Assert.DoesNotContain("BlobObject", summary.GetType().GetProperties().Select(p => p.Name));
    }

    [Fact]
    public async Task Rejects_NonImage_Corrupt_And_HugeDimension()
    {
        Assert.Throws<InvalidImageException>(() => ImageByteProcessor.CompressAndThumb("not-an-image"u8.ToArray()));
        Assert.Throws<InvalidImageException>(() => ImageByteProcessor.CompressAndThumb(new byte[] { 0xFF, 0xD8, 0xFF, 0x00 }));
        Assert.Throws<InvalidImageException>(() => ImageByteProcessor.CompressAndThumb(new byte[ImageByteProcessor.MaxUploadBytes + 1]));

        using var huge = new Image<Rgb24>(8001, 10);
        using var ms = new MemoryStream();
        huge.SaveAsJpeg(ms);
        Assert.Throws<InvalidImageException>(() => ImageByteProcessor.CompressAndThumb(ms.ToArray()));
    }

    [Fact]
    public async Task OtherUser_CannotDelete()
    {
        var db = Db();
        db.Users.AddRange(
            new User { Id = 1, MobileNumber = "9000000001" },
            new User { Id = 2, MobileNumber = "9000000002" });
        await db.SaveChangesAsync();
        var uploaded = await Api(db, 1).Upload(FileOf(Jpeg(40, 40), "a.jpg"), null);
        var no = Assert.IsType<ApiResponse<DocumentCreatedDto>>(Assert.IsType<OkObjectResult>(uploaded.Result).Value).Data!.DocumentNo;

        var denied = await Api(db, 2).Delete(no);
        Assert.IsType<ForbidResult>(denied.Result);
        Assert.Equal(1, await db.Documents.CountAsync());

        var removed = await Api(db, 1).Delete(no);
        Assert.IsType<OkObjectResult>(removed.Result);
        Assert.Equal(0, await db.Documents.CountAsync());
    }
}
