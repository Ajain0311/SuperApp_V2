namespace SuperApp.API.Services;

/// <summary>
/// Development/Offline storage provider that stores uploaded files in the application's local wwwroot/uploads folder.
/// Requires zero third-party cloud credentials.
/// </summary>
public class LocalStorageService : IStorageService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<LocalStorageService> _logger;

    public LocalStorageService(IWebHostEnvironment env, ILogger<LocalStorageService> logger)
    {
        _env = env;
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "general")
    {
        try
        {
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var uploadsFolder = Path.Combine(webRoot, "uploads", folder);

            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var extension = Path.GetExtension(fileName);
            var safeName = Path.GetFileNameWithoutExtension(fileName)
                .Replace(" ", "_")
                .Replace("..", "");
            
            var uniqueFileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString("N")[..8]}_{safeName}{extension}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using var output = new FileStream(filePath, FileMode.Create);
            await fileStream.CopyToAsync(output);

            _logger.LogInformation("File saved locally: {FilePath}", filePath);
            return $"/uploads/{folder}/{uniqueFileName}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload file locally: {FileName}", fileName);
            throw;
        }
    }

    public Task<bool> DeleteFileAsync(string fileUrl)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(fileUrl)) return Task.FromResult(false);

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var relativePath = fileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relativePath);

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
                _logger.LogInformation("File deleted locally: {FullPath}", fullPath);
                return Task.FromResult(true);
            }

            return Task.FromResult(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete file locally: {FileUrl}", fileUrl);
            return Task.FromResult(false);
        }
    }

    public string GetFileUrl(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return string.Empty;
        if (relativePath.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            relativePath.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return relativePath;
        }

        return relativePath.StartsWith('/') ? relativePath : $"/{relativePath}";
    }
}
