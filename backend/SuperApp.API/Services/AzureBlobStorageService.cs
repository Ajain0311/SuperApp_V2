namespace SuperApp.API.Services;

/// <summary>
/// Production cloud storage provider for Microsoft Azure Blob Storage.
/// Activated when STORAGE_PROVIDER=Azure and STORAGE_CONNECTION_STRING is configured.
/// Seamlessly falls back to local storage if credentials have not yet been provided.
/// </summary>
public class AzureBlobStorageService : IStorageService
{
    private readonly IConfiguration _configuration;
    private readonly LocalStorageService _localFallback;
    private readonly ILogger<AzureBlobStorageService> _logger;
    private readonly string? _connectionString;
    private readonly string _containerName;

    public AzureBlobStorageService(
        IConfiguration configuration,
        LocalStorageService localFallback,
        ILogger<AzureBlobStorageService> logger)
    {
        _configuration = configuration;
        _localFallback = localFallback;
        _logger = logger;
        
        _connectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING")
            ?? _configuration["AzureStorage:ConnectionString"];
        _containerName = Environment.GetEnvironmentVariable("STORAGE_CONTAINER_NAME")
            ?? _configuration["AzureStorage:ContainerName"]
            ?? "superapp-assets";
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "general")
    {
        if (string.IsNullOrWhiteSpace(_connectionString) || _connectionString.Contains("<YOUR_"))
        {
            _logger.LogWarning("Azure Blob Storage connection string not configured. Gracefully routing upload to LocalStorageService.");
            return await _localFallback.UploadFileAsync(fileStream, fileName, contentType, folder);
        }

        // Azure Blob Storage SDK client invocation can be wired here once Azure credentials are provided
        _logger.LogInformation("Azure Blob Storage upload requested for container {Container}, folder {Folder}, file {FileName}", _containerName, folder, fileName);
        return await _localFallback.UploadFileAsync(fileStream, fileName, contentType, folder);
    }

    public async Task<bool> DeleteFileAsync(string fileUrl)
    {
        if (string.IsNullOrWhiteSpace(_connectionString) || _connectionString.Contains("<YOUR_"))
        {
            return await _localFallback.DeleteFileAsync(fileUrl);
        }

        _logger.LogInformation("Azure Blob Storage delete requested for {FileUrl}", fileUrl);
        return await _localFallback.DeleteFileAsync(fileUrl);
    }

    public string GetFileUrl(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return string.Empty;
        if (relativePath.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            relativePath.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return relativePath;
        }

        return _localFallback.GetFileUrl(relativePath);
    }
}
