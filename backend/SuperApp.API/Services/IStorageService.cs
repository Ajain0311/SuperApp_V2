namespace SuperApp.API.Services;

/// <summary>
/// Provider-agnostic storage abstraction for file, image, and document assets.
/// Implementations include LocalStorageService (development/testing) and AzureBlobStorageService (production).
/// </summary>
public interface IStorageService
{
    /// <summary>
    /// Uploads a stream to storage and returns the accessible public/relative URL.
    /// </summary>
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string folder = "general");

    /// <summary>
    /// Deletes a file from storage by its URL.
    /// </summary>
    Task<bool> DeleteFileAsync(string fileUrl);

    /// <summary>
    /// Formats a stored relative path into a fully qualified or client-consumable URL.
    /// </summary>
    string GetFileUrl(string relativePath);
}
