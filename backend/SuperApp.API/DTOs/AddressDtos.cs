using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.DTOs;

public class AddressDto
{
    public long Id { get; set; }
    public string? Label { get; set; }
    public string AddressLine1 { get; set; } = string.Empty;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string PinCode { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool IsDefault { get; set; }
}

public class UpsertAddressRequest
{
    [MaxLength(50)]
    public string? Label { get; set; }

    [Required, MaxLength(255)]
    public string AddressLine1 { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? AddressLine2 { get; set; }

    [Required, MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string State { get; set; } = string.Empty;

    [Required, MaxLength(10)]
    public string PinCode { get; set; } = string.Empty;

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public bool IsDefault { get; set; }
}
