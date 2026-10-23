using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;

namespace SuperApp.API.Services;

public class RoleApplicationService
{
    private readonly AppDbContext _db;

    public RoleApplicationService(AppDbContext db)
    {
        _db = db;
    }

    public static RoleApplicationDto ToDto(RoleApplication a, User? user = null)
    {
        return new RoleApplicationDto
        {
            Id = a.Id,
            UserId = a.UserId,
            UserName = user?.FullName ?? a.User?.FullName,
            UserMobile = user?.MobileNumber ?? a.User?.MobileNumber,
            RequestedRole = a.RequestedRole,
            Status = a.Status,
            LicenseNumber = a.LicenseNumber,
            LicenseDocumentNo = a.LicenseDocumentNo,
            LicenseImageUrl = string.IsNullOrWhiteSpace(a.LicenseDocumentNo)
                ? null
                : $"/api/documents/{a.LicenseDocumentNo}/image",
            VehicleType = a.VehicleType,
            VehicleRegistrationNumber = a.VehicleRegistrationNumber,
            VehicleMake = a.VehicleMake,
            VehicleModel = a.VehicleModel,
            HotelName = a.HotelName,
            HotelAddress = a.HotelAddress,
            HotelCity = a.HotelCity,
            HotelPhone = a.HotelPhone,
            BusinessDocumentNo = a.BusinessDocumentNo,
            BusinessDocumentImageUrl = string.IsNullOrWhiteSpace(a.BusinessDocumentNo)
                ? null
                : $"/api/documents/{a.BusinessDocumentNo}/image",
            ApplicantNotes = a.ApplicantNotes,
            AdminNotes = a.AdminNotes,
            ReviewedByAdminName = a.ReviewedByAdminName,
            ReviewedAt = a.ReviewedAt,
            ResultRestaurantId = a.ResultRestaurantId,
            CreatedAt = a.CreatedAt
        };
    }

    public async Task EnsureCitizenRoleAsync(long userId, CancellationToken ct = default)
    {
        var customerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleNames.Customer, ct);
        if (customerRole == null) return;
        var has = await _db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == customerRole.Id, ct);
        if (has) return;
        _db.UserRoles.Add(new UserRole { UserId = userId, RoleId = customerRole.Id, CreatedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<(bool Ok, string? Error)> ValidateDocumentOwnedAsync(string? documentNo, long userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(documentNo))
            return (false, "Document is required");
        var doc = await _db.Documents.AsNoTracking()
            .FirstOrDefaultAsync(d => d.DocumentNo == documentNo.Trim(), ct);
        if (doc == null)
            return (false, "Uploaded document was not found");
        if (doc.OwnerUserId != userId)
            return (false, "Document does not belong to this user");
        return (true, null);
    }

    public async Task<(RoleApplication? App, string? Error)> SubmitAsync(
        long userId,
        SubmitRoleApplicationRequest request,
        CancellationToken ct = default)
    {
        await EnsureCitizenRoleAsync(userId, ct);

        var role = (request.RequestedRole ?? string.Empty).Trim().ToUpperInvariant();
        if (role is not (RoleNames.Driver or RoleNames.RestaurantOwner))
            return (null, "Requested role must be DRIVER or RESTAURANT_OWNER");

        var alreadyHas = await _db.UserRoles.AnyAsync(
            ur => ur.UserId == userId && ur.Role.Name == role, ct);
        if (alreadyHas)
            return (null, $"You already have the {role} role");

        var pending = await _db.RoleApplications.AnyAsync(
            a => a.UserId == userId && a.RequestedRole == role && a.Status == RoleApplicationStatuses.Pending, ct);
        if (pending)
            return (null, $"A pending {role} application already exists");

        var app = new RoleApplication
        {
            UserId = userId,
            RequestedRole = role,
            Status = RoleApplicationStatuses.Pending,
            ApplicantNotes = string.IsNullOrWhiteSpace(request.ApplicantNotes) ? null : request.ApplicantNotes.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        if (role == RoleNames.Driver)
        {
            if (string.IsNullOrWhiteSpace(request.LicenseNumber) || request.LicenseNumber.Trim().Length < 5)
                return (null, "Driving license number is required (min 5 characters)");
            var (docOk, docErr) = await ValidateDocumentOwnedAsync(request.LicenseDocumentNo, userId, ct);
            if (!docOk) return (null, docErr ?? "License photo upload is required");
            if (!VehicleTypes.TryNormalize(request.VehicleType, out var vehicleType))
                return (null, "Vehicle type must be BIKE, AUTO, or CAB");
            if (string.IsNullOrWhiteSpace(request.VehicleRegistrationNumber) || request.VehicleRegistrationNumber.Trim().Length < 4)
                return (null, "Vehicle registration number is required");

            app.LicenseNumber = request.LicenseNumber.Trim().ToUpperInvariant();
            app.LicenseDocumentNo = request.LicenseDocumentNo!.Trim();
            app.VehicleType = vehicleType;
            app.VehicleRegistrationNumber = request.VehicleRegistrationNumber.Trim().ToUpperInvariant();
            app.VehicleMake = string.IsNullOrWhiteSpace(request.VehicleMake) ? null : request.VehicleMake.Trim();
            app.VehicleModel = string.IsNullOrWhiteSpace(request.VehicleModel) ? null : request.VehicleModel.Trim();
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.HotelName) || request.HotelName.Trim().Length < 2)
                return (null, "Hotel / restaurant name is required");
            if (string.IsNullOrWhiteSpace(request.HotelAddress) || request.HotelAddress.Trim().Length < 5)
                return (null, "Hotel address is required");
            if (string.IsNullOrWhiteSpace(request.HotelPhone) || request.HotelPhone.Trim().Length < 8)
                return (null, "Hotel contact phone is required");
            var (docOk, docErr) = await ValidateDocumentOwnedAsync(request.BusinessDocumentNo, userId, ct);
            if (!docOk) return (null, docErr ?? "Business / FSSAI document upload is required");

            app.HotelName = request.HotelName.Trim();
            app.HotelAddress = request.HotelAddress.Trim();
            app.HotelCity = string.IsNullOrWhiteSpace(request.HotelCity) ? "DEFAULT" : request.HotelCity.Trim();
            app.HotelPhone = request.HotelPhone.Trim();
            app.BusinessDocumentNo = request.BusinessDocumentNo!.Trim();
        }

        _db.RoleApplications.Add(app);
        await _db.SaveChangesAsync(ct);
        return (app, null);
    }

    public async Task<(RoleApplication? App, string? Error)> ApproveAsync(
        long applicationId,
        long adminId,
        string? adminName,
        CancellationToken ct = default)
    {
        var app = await _db.RoleApplications
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (app == null) return (null, "Application not found");
        if (app.Status != RoleApplicationStatuses.Pending)
            return (null, $"Application is already {app.Status}");

        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == app.RequestedRole, ct);
        if (role == null) return (null, $"Role {app.RequestedRole} is not configured");

        await EnsureCitizenRoleAsync(app.UserId, ct);

        var hasRole = await _db.UserRoles.AnyAsync(ur => ur.UserId == app.UserId && ur.RoleId == role.Id, ct);
        if (!hasRole)
        {
            _db.UserRoles.Add(new UserRole { UserId = app.UserId, RoleId = role.Id, CreatedAt = DateTime.UtcNow });
        }

        if (app.RequestedRole == RoleNames.Driver)
        {
            var driver = await _db.Drivers.Include(d => d.Vehicles).FirstOrDefaultAsync(d => d.UserId == app.UserId, ct);
            if (driver == null)
            {
                driver = new Driver
                {
                    UserId = app.UserId,
                    LicenseNumber = app.LicenseNumber,
                    IsVerified = true,
                    IsOnline = false,
                    Rating = 5.0m,
                    TotalRides = 0,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Drivers.Add(driver);
                await _db.SaveChangesAsync(ct);
            }
            else
            {
                driver.LicenseNumber = app.LicenseNumber ?? driver.LicenseNumber;
                driver.IsVerified = true;
                driver.IsActive = true;
                driver.UpdatedAt = DateTime.UtcNow;
            }

            var hasVehicle = await _db.Vehicles.AnyAsync(v => v.DriverId == driver.Id && v.IsActive, ct);
            if (!hasVehicle)
            {
                VehicleTypes.TryNormalize(app.VehicleType, out var vType);
                _db.Vehicles.Add(new Vehicle
                {
                    DriverId = driver.Id,
                    Type = vType,
                    Make = app.VehicleMake ?? "Generic",
                    Model = app.VehicleModel ?? "Standard",
                    RegistrationNumber = app.VehicleRegistrationNumber ?? $"TMP{driver.Id}",
                    Color = "Black",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else if (app.RequestedRole == RoleNames.RestaurantOwner)
        {
            var restaurant = new Restaurant
            {
                Name = app.HotelName ?? "New Hotel",
                Description = "Pending menu setup",
                Phone = app.HotelPhone,
                AddressLine = app.HotelAddress,
                City = app.HotelCity ?? "DEFAULT",
                MinOrderAmount = 100,
                DeliveryFee = 30,
                AvgDeliveryTimeMinutes = 35,
                IsActive = true,
                IsFeatured = false,
                CreatedAt = DateTime.UtcNow
            };
            _db.Restaurants.Add(restaurant);
            await _db.SaveChangesAsync(ct);

            _db.RestaurantUsers.Add(new RestaurantUser
            {
                UserId = app.UserId,
                RestaurantId = restaurant.Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            app.ResultRestaurantId = restaurant.Id;
        }

        app.Status = RoleApplicationStatuses.Approved;
        app.ReviewedByAdminId = adminId;
        app.ReviewedByAdminName = string.IsNullOrWhiteSpace(adminName) ? "Admin" : adminName.Trim();
        app.ReviewedAt = DateTime.UtcNow;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return (app, null);
    }

    public async Task<(RoleApplication? App, string? Error)> RejectAsync(
        long applicationId,
        long adminId,
        string? adminName,
        string? notes,
        CancellationToken ct = default)
    {
        var app = await _db.RoleApplications.FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (app == null) return (null, "Application not found");
        if (app.Status != RoleApplicationStatuses.Pending)
            return (null, $"Application is already {app.Status}");

        app.Status = RoleApplicationStatuses.Rejected;
        app.AdminNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        app.ReviewedByAdminId = adminId;
        app.ReviewedByAdminName = string.IsNullOrWhiteSpace(adminName) ? "Admin" : adminName.Trim();
        app.ReviewedAt = DateTime.UtcNow;
        app.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return (app, null);
    }
}
