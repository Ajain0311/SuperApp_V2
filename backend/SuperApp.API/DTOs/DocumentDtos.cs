namespace SuperApp.API.DTOs;

public class DocumentCreatedDto
{
    public string DocumentNo { get; set; } = string.Empty;
    public string DocumentName { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public int ByteSize { get; set; }
}
