using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SuperApp.API.Models;

/// <summary>
/// Citizen-submitted request to become a DRIVER (rider) or RESTAURANT_OWNER (hotel).
/// Admin must approve before the role is granted. Marketplace sell stays open without this flow.
/// </summary>
public class RoleApplication
{
    [Key]
    public long Id { get; set; }

    public long UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public User User { get; set; } = null!;

    /// <summary>DRIVER or RESTAURANT_OWNER</summary>
    [Required, MaxLength(40)]
    public string RequestedRole { get; set; } = string.Empty;

    /// <summary>PENDING | APPROVED | REJECTED | CANCELLED</summary>
    [Required, MaxLength(20)]
    public string Status { get; set; } = RoleApplicationStatuses.Pending;

    // --- Driver / rider fields ---
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

    // --- Hotel / restaurant fields ---
    [MaxLength(150)]
    public string? HotelName { get; set; }

    [MaxLength(300)]
    public string? HotelAddress { get; set; }

    [MaxLength(80)]
    public string? HotelCity { get; set; }

    [MaxLength(20)]
    public string? HotelPhone { get; set; }

    /// <summary>Business registration / FSSAI / shop license document in documents table.</summary>
    [MaxLength(40)]
    public string? BusinessDocumentNo { get; set; }

    [MaxLength(500)]
    public string? ApplicantNotes { get; set; }

    [MaxLength(500)]
    public string? AdminNotes { get; set; }

    public long? ReviewedByAdminId { get; set; }

    [MaxLength(100)]
    public string? ReviewedByAdminName { get; set; }

    public DateTime? ReviewedAt { get; set; }

    /// <summary>Restaurant created/linked on hotel approval.</summary>
    public long? ResultRestaurantId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}

public static class RoleApplicationStatuses
{
    public const string Pending = "PENDING";
    public const string Approved = "APPROVED";
    public const string Rejected = "REJECTED";
    public const string Cancelled = "CANCELLED";
}

public static class RoleApplicationRoles
{
    public const string Driver = RoleNames.Driver;
    public const string RestaurantOwner = RoleNames.RestaurantOwner;
}
