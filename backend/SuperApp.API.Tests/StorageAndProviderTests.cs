using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using SuperApp.API.Services;

namespace SuperApp.API.Tests;

public class StorageAndProviderTests
{
    private class DummyWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = Path.Combine(Path.GetTempPath(), "SuperAppTestWebRoot_" + Guid.NewGuid().ToString("N"));
        public IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ApplicationName { get; set; } = "SuperApp.API";
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public string EnvironmentName { get; set; } = "Development";
    }

    [Fact]
    public async Task LocalStorageService_UploadAndRetrieve_Succeeds()
    {
        var env = new DummyWebHostEnvironment();
        var logger = NullLogger<LocalStorageService>.Instance;
        var storage = new LocalStorageService(env, logger);

        const string content = "SuperApp test image content payload";
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));

        var fileUrl = await storage.UploadFileAsync(stream, "dish_avatar.jpg", "image/jpeg", "dishes");

        Assert.NotNull(fileUrl);
        Assert.StartsWith("/uploads/dishes/", fileUrl);
        Assert.EndsWith(".jpg", fileUrl);

        var formattedUrl = storage.GetFileUrl(fileUrl);
        Assert.Equal(fileUrl, formattedUrl);

        // Delete test
        var deleted = await storage.DeleteFileAsync(fileUrl);
        Assert.True(deleted);

        // Clean up test directory
        if (Directory.Exists(env.WebRootPath))
        {
            Directory.Delete(env.WebRootPath, true);
        }
    }

    [Fact]
    public void StorageService_GetFileUrl_PreservesAbsoluteUrls()
    {
        var env = new DummyWebHostEnvironment();
        var storage = new LocalStorageService(env, NullLogger<LocalStorageService>.Instance);

        const string externalUrl = "https://images.unsplash.com/photo-sample";
        var result = storage.GetFileUrl(externalUrl);

        Assert.Equal(externalUrl, result);
    }
}
