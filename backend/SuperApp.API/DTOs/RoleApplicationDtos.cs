using System.ComponentModel.DataAnnotations;

namespace SuperApp.API.DTOs;

public class SubmitRoleApplicationRequest
{
    /// <summary>DRIVER or RESTAURANT_OWNER</summary>
    [Required, MaxLength(40)]
    public string RequestedRole { get; set; } = string.Empty;

    // Driver
    [MaxLength(50)]
    public string? LicenseNumber { get; set; }

    [MaxLength(40)]
    public string? LicenseDocumentNo { get; set; }

    [MaxLength(20)]
    public string? VehicleType { get; set; }

    [MaxLength(30)]
    public string? VehicleRegistrationNumber { get; set; }

    [MaxLength(40)]
    public string? VehicleMake { get; set; }

    [MaxLength(40)]
    public string? VehicleModel { get; set; }

    // Hotel
    [MaxLength(150)]
    public string? HotelName { get; set; }

    [MaxLength(300)]
    public string? HotelAddress { get; set; }

    [MaxLength(80)]
    public string? HotelCity { get; set; }

    [MaxLength(20)]
    public string? HotelPhone { get; set; }

    [MaxLength(40)]
    public string? BusinessDocumentNo { get; set; }

    [MaxLength(500)]
    public string? ApplicantNotes { get; set; }
}

public class RejectRoleApplicationRequest
{
    [MaxLength(500)]
    public string? AdminNotes { get; set; }
}

public class RoleApplicationDto
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserMobile { get; set; }
    public string RequestedRole { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
    public string? LicenseDocumentNo { get; set; }
    public string? LicenseImageUrl { get; set; }
    public string? VehicleType { get; set; }
    public string? VehicleRegistrationNumber { get; set; }
    public string? VehicleMake { get; set; }
    public string? VehicleModel { get; set; }
    public string? HotelName { get; set; }
    public string? HotelAddress { get; set; }
    public string? HotelCity { get; set; }
    public string? HotelPhone { get; set; }
    public string? BusinessDocumentNo { get; set; }
    public string? BusinessDocumentImageUrl { get; set; }
    public string? ApplicantNotes { get; set; }
    public string? AdminNotes { get; set; }
    public string? ReviewedByAdminName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public long? ResultRestaurantId { get; set; }
    public DateTime CreatedAt { get; set; }
}
