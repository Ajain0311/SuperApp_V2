using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperApp.API.Data;
using SuperApp.API.DTOs;
using SuperApp.API.Models;
using SuperApp.API.Services;

namespace SuperApp.API.Controllers;

[Authorize(Roles = RoleNames.Admin)]
[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Global Platform Overview KPIs and real-time statistics
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResponse<AdminDashboardDto>>> GetDashboard()
    {
        var totalUsers = await _db.Users.CountAsync();
        var activeDrivers = await _db.Drivers.CountAsync(d => d.IsActive && d.IsVerified);
        var totalRestaurants = await _db.Restaurants.CountAsync(r => r.IsActive);
        var totalFoodOrders = await _db.FoodOrders.CountAsync();
        var totalRides = await _db.Rides.CountAsync();
        var activeListings = await _db.MarketplaceListings.CountAsync(l => l.IsActive && l.Status == ListingStatus.Active);

        var foodSales = await _db.FoodOrders.Where(o => o.Status == OrderStatus.Delivered).SumAsync(o => (decimal?)o.GrandTotal) ?? 0;
        var rideFares = await _db.Rides.Where(r => r.Status == RideStatus.Completed).SumAsync(r => (decimal?)r.ActualFare) ?? 0;

        decimal platformCommission = Math.Round(foodSales * 0.15m + rideFares * 0.20m, 2);

        var recentActivities = new List<RecentActivityDto>();

        var recentFoodOrders = await _db.FoodOrders
            .Include(o => o.Restaurant)
            .OrderByDescending(o => o.CreatedAt)
            .Take(5)
            .ToListAsync();

        foreach (var fo in recentFoodOrders)
        {
            recentActivities.Add(new RecentActivityDto
            {
                Id = $"FO-{fo.Id}",
                Module = "FOOD",
                Description = $"Food order #{fo.OrderNumber} ({fo.Restaurant?.Name ?? "Restaurant"})",
                Amount = fo.GrandTotal,
                Status = fo.Status,
                Timestamp = fo.CreatedAt
            });
        }

        var recentRides = await _db.Rides
            .OrderByDescending(r => r.CreatedAt)
            .Take(5)
            .ToListAsync();

        foreach (var r in recentRides)
        {
            recentActivities.Add(new RecentActivityDto
            {
                Id = $"RD-{r.Id}",
                Module = "RIDE",
                Description = $"{r.VehicleType} ride {r.RideNumber}",
                Amount = r.ActualFare ?? r.EstimatedFare,
                Status = r.Status,
                Timestamp = r.CreatedAt
            });
        }

        recentActivities = recentActivities.OrderByDescending(a => a.Timestamp).Take(10).ToList();

        var result = new AdminDashboardDto
        {
            TotalUsers = totalUsers,
            ActiveDrivers = activeDrivers,
            TotalRestaurants = totalRestaurants,
            TotalFoodOrders = totalFoodOrders,
            TotalRides = totalRides,
            ActiveListings = activeListings,
            GrossFoodSales = foodSales,
            GrossRideFares = rideFares,
            PlatformRevenue = platformCommission,
            RecentActivities = recentActivities
        };

        return Ok(ApiResponse<AdminDashboardDto>.Ok(result));
    }

    /// <summary>
    /// User Accounts Management with role filtering and search
    /// </summary>
    [HttpGet("users")]
    public async Task<ActionResult<ApiResponse<PagedResult<AdminUserDto>>>> GetUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var digits = new string(term.Where(char.IsDigit).ToArray());
            long parsedId = 0;
            var hasId = long.TryParse(digits, out parsedId) && digits.Length > 0 && digits.Length < 12;
            query = query.Where(u =>
                u.MobileNumber.Contains(term)
                || (digits.Length >= 4 && u.MobileNumber.Contains(digits))
                || (u.FullName != null && u.FullName.Contains(term))
                || (u.Email != null && u.Email.Contains(term))
                || (hasId && u.Id == parsedId));
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(u => u.UserRoles.Any(ur => ur.Role.Name == role));
        }

        var totalCount = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                MobileNumber = u.MobileNumber,
                FullName = u.FullName,
                Email = u.Email,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                Roles = u.UserRoles.Select(ur => ur.Role.Name).ToList()
            })
            .ToListAsync();

        return Ok(ApiResponse<PagedResult<AdminUserDto>>.Ok(new PagedResult<AdminUserDto>
        {
            Items = users,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        }));
    }

    /// <summary>
    /// User Action Endpoint: STATUS (activate/suspend), ROLE (add/remove)
    /// </summary>
    [HttpPost("users")]
    public async Task<ActionResult<ApiResponse>> ManageUser([FromBody] AdminUserActionRequest request)
    {
        var user = await _db.Users.Include(u => u.UserRoles).FirstOrDefaultAsync(u => u.Id == request.UserId);
        if (user == null)
            return NotFound(ApiResponse.Fail("User not found"));

        switch (request.Action?.ToUpperInvariant())
        {
            case "STATUS":
                if (!request.IsActive.HasValue)
                    return BadRequest(ApiResponse.Fail("IsActive flag is required"));
                user.IsActive = request.IsActive.Value;
                user.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok($"User account status set to {(user.IsActive ? "ACTIVE" : "SUSPENDED")}"));

            case "ROLE":
                if (string.IsNullOrWhiteSpace(request.RoleName))
                    return BadRequest(ApiResponse.Fail("RoleName is required"));

                var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == request.RoleName.Trim().ToUpperInvariant());
                if (role == null)
                    return BadRequest(ApiResponse.Fail($"Role '{request.RoleName}' does not exist"));

                var existingRole = user.UserRoles.FirstOrDefault(ur => ur.RoleId == role.Id);
                if (string.Equals(request.Action, "REMOVE_ROLE", StringComparison.OrdinalIgnoreCase))
                {
                    if (role.Name == RoleNames.Customer)
                        return BadRequest(ApiResponse.Fail("Customer access stays on the account"));
                    if (existingRole != null)
                    {
                        _db.UserRoles.Remove(existingRole);
                        if (role.Name == RoleNames.RestaurantOwner)
                        {
                            var restMapping = await _db.RestaurantUsers.FirstOrDefaultAsync(ru => ru.UserId == user.Id);
                            if (restMapping != null)
                            {
                                restMapping.IsActive = false;
                            }
                        }
                        await _db.SaveChangesAsync();
                        return Ok(ApiResponse.Ok($"Removed role {role.Name} from user #{user.Id}"));
                    }
                    return Ok(ApiResponse.Ok($"User #{user.Id} does not have role {role.Name}"));
                }
                else
                {
                    if (existingRole == null)
                    {
                        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, CreatedAt = DateTime.UtcNow });
                    }
                    
                    // Provision Driver profile & vehicle if assigning DRIVER
                    if (role.Name == RoleNames.Driver)
                    {
                        var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.UserId == user.Id);
                        if (driver == null)
                        {
                            driver = new Driver
                            {
                                UserId = user.Id,
                                IsOnline = false,
                                Rating = 5.0m,
                                TotalRides = 0,
                                IsVerified = true,
                                CreatedAt = DateTime.UtcNow
                            };
                            _db.Drivers.Add(driver);
                            await _db.SaveChangesAsync();

                            var vehicle = new Vehicle
                            {
                                DriverId = driver.Id,
                                Type = VehicleTypes.Bike,
                                Make = "Hero",
                                Model = "Splendor Plus",
                                RegistrationNumber = $"DL {Random.Shared.Next(1, 99):D2} AB {Random.Shared.Next(1000, 9999)}",
                                Color = "Black",
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow
                            };
                            _db.Vehicles.Add(vehicle);
                        }
                    }

                    // Provision RestaurantUser mapping if assigning RESTAURANT_OWNER
                    if (role.Name == RoleNames.RestaurantOwner)
                    {
                        var targetRestId = request.RestaurantId;
                        if (!targetRestId.HasValue || targetRestId.Value <= 0)
                        {
                            targetRestId = await _db.Restaurants.Where(r => r.IsActive).Select(r => r.Id).FirstOrDefaultAsync();
                        }

                        if (targetRestId.HasValue && targetRestId.Value > 0)
                        {
                            var restMapping = await _db.RestaurantUsers.FirstOrDefaultAsync(ru => ru.UserId == user.Id);
                            if (restMapping == null)
                            {
                                _db.RestaurantUsers.Add(new RestaurantUser
                                {
                                    UserId = user.Id,
                                    RestaurantId = targetRestId.Value,
                                    IsActive = true,
                                    CreatedAt = DateTime.UtcNow
                                });
                            }
                            else
                            {
                                restMapping.RestaurantId = targetRestId.Value;
                                restMapping.IsActive = true;
                            }
                        }
                    }

                    await _db.SaveChangesAsync();
                    return Ok(ApiResponse.Ok($"Assigned role {role.Name} to user #{user.Id}"));
                }

            default:
                return BadRequest(ApiResponse.Fail($"Unknown user action '{request.Action}'. Use STATUS or ROLE."));
        }
    }

    /// <summary>
    /// Link an existing customer to restaurant, captain, or bazaar seller profiles.
    /// Customer access is always kept.
    /// </summary>
    [HttpPost("users/assign")]
    public async Task<ActionResult<ApiResponse<AdminUserDto>>> AssignProfiles([FromBody] AdminAssignProfileRequest request)
    {
        var user = await _db.Users.Include(u => u.UserRoles).FirstOrDefaultAsync(u => u.Id == request.UserId);
        if (user == null)
            return NotFound(ApiResponse<AdminUserDto>.Fail("User not found"));

        var wanted = request.Roles
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim().ToUpperInvariant())
            .Distinct()
            .ToList();
        if (!wanted.Contains(RoleNames.Customer))
            wanted.Add(RoleNames.Customer);

        var known = await _db.Roles.ToListAsync();
        foreach (var name in wanted)
        {
            var role = known.FirstOrDefault(r => r.Name == name);
            if (role == null)
                return BadRequest(ApiResponse<AdminUserDto>.Fail($"Role '{name}' does not exist"));
            if (user.UserRoles.All(ur => ur.RoleId != role.Id))
                _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, CreatedAt = DateTime.UtcNow });
        }

        if (wanted.Contains(RoleNames.RestaurantOwner))
        {
            if (string.IsNullOrWhiteSpace(request.RestaurantName))
                return BadRequest(ApiResponse<AdminUserDto>.Fail("Restaurant name is required"));
            var restaurant = new Restaurant
            {
                Name = request.RestaurantName.Trim(),
                Description = request.Cuisine?.Trim(),
                Phone = string.IsNullOrWhiteSpace(request.Phone) ? user.MobileNumber : request.Phone.Trim(),
                AddressLine = request.Address?.Trim(),
                City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim(),
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _db.Restaurants.Add(restaurant);
            await _db.SaveChangesAsync();
            var link = await _db.RestaurantUsers.FirstOrDefaultAsync(ru => ru.UserId == user.Id);
            if (link == null)
            {
                _db.RestaurantUsers.Add(new RestaurantUser
                {
                    UserId = user.Id,
                    RestaurantId = restaurant.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                link.RestaurantId = restaurant.Id;
                link.IsActive = true;
            }
        }

        if (wanted.Contains(RoleNames.Driver))
        {
            var driver = await _db.Drivers.FirstOrDefaultAsync(d => d.UserId == user.Id);
            if (driver == null)
            {
                driver = new Driver
                {
                    UserId = user.Id,
                    LicenseNumber = request.LicenseNumber?.Trim(),
                    IsVerified = true,
                    IsOnline = false,
                    Rating = 5.0m,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Drivers.Add(driver);
                await _db.SaveChangesAsync();
                _db.Vehicles.Add(new Vehicle
                {
                    DriverId = driver.Id,
                    Type = string.IsNullOrWhiteSpace(request.VehicleType) ? VehicleTypes.Bike : request.VehicleType.Trim().ToUpperInvariant(),
                    RegistrationNumber = "PENDING",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                driver.IsActive = true;
                driver.IsVerified = true;
                if (!string.IsNullOrWhiteSpace(request.LicenseNumber))
                    driver.LicenseNumber = request.LicenseNumber.Trim();
            }
        }

        await _db.SaveChangesAsync();
        var roles = await _db.UserRoles.Where(ur => ur.UserId == user.Id).Include(ur => ur.Role).Select(ur => ur.Role.Name).ToListAsync();
        return Ok(ApiResponse<AdminUserDto>.Ok(new AdminUserDto
        {
            Id = user.Id,
            MobileNumber = user.MobileNumber,
            FullName = user.FullName,
            Email = user.Email,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt,
            Roles = roles
        }, "Roles saved on the existing account"));
    }

    /// <summary>
    /// List Restaurants for admin control
    /// </summary>
    [HttpGet("restaurants")]
    public async Task<ActionResult<ApiResponse<List<Restaurant>>>> GetRestaurants([FromQuery] string? search)
    {
        var query = _db.Restaurants.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(r => r.Name.Contains(search) || (r.City != null && r.City.Contains(search)));
        }

        var restaurants = await query.OrderByDescending(r => r.IsFeatured).ThenBy(r => r.Name).ToListAsync();
        return Ok(ApiResponse<List<Restaurant>>.Ok(restaurants));
    }

    /// <summary>
    /// Restaurant Action Endpoint: ADD, EDIT, DELETE, STATUS, FEATURED
    /// </summary>
    [HttpPost("restaurants")]
    public async Task<ActionResult<ApiResponse<Restaurant>>> ManageRestaurant([FromBody] AdminRestaurantActionRequest request)
    {
        switch (request.Action?.ToUpperInvariant())
        {
            case "ADD":
                if (string.IsNullOrWhiteSpace(request.Name))
                    return BadRequest(ApiResponse<Restaurant>.Fail("Restaurant name is required"));

                var newRest = new Restaurant
                {
                    Name = request.Name.Trim(),
                    Description = request.Description?.Trim(),
                    Phone = request.Phone?.Trim(),
                    AddressLine = request.AddressLine?.Trim(),
                    City = request.City?.Trim() ?? "Bengaluru",
                    IsVeg = request.IsVeg ?? false,
                    IsActive = true,
                    IsFeatured = request.IsFeatured ?? false,
                    MinOrderAmount = request.MinOrderAmount ?? 100,
                    DeliveryFee = request.DeliveryFee ?? 25,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Restaurants.Add(newRest);
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Restaurant>.Ok(newRest, "Restaurant added successfully"));

            case "EDIT":
                if (!request.Id.HasValue) return BadRequest(ApiResponse<Restaurant>.Fail("ID is required for EDIT"));
                var rest = await _db.Restaurants.FindAsync(request.Id.Value);
                if (rest == null) return NotFound(ApiResponse<Restaurant>.Fail("Restaurant not found"));

                if (!string.IsNullOrWhiteSpace(request.Name)) rest.Name = request.Name.Trim();
                if (!string.IsNullOrWhiteSpace(request.Description)) rest.Description = request.Description.Trim();
                if (!string.IsNullOrWhiteSpace(request.Phone)) rest.Phone = request.Phone.Trim();
                if (!string.IsNullOrWhiteSpace(request.AddressLine)) rest.AddressLine = request.AddressLine.Trim();
                if (!string.IsNullOrWhiteSpace(request.City)) rest.City = request.City.Trim();
                if (request.IsVeg.HasValue) rest.IsVeg = request.IsVeg.Value;
                if (request.MinOrderAmount.HasValue) rest.MinOrderAmount = request.MinOrderAmount.Value;
                if (request.DeliveryFee.HasValue) rest.DeliveryFee = request.DeliveryFee.Value;
                rest.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Restaurant>.Ok(rest, "Restaurant updated successfully"));

            case "STATUS":
                if (!request.Id.HasValue || !request.IsActive.HasValue)
                    return BadRequest(ApiResponse<Restaurant>.Fail("ID and IsActive flag are required"));
                var restStatus = await _db.Restaurants.FindAsync(request.Id.Value);
                if (restStatus == null) return NotFound(ApiResponse<Restaurant>.Fail("Restaurant not found"));
                restStatus.IsActive = request.IsActive.Value;
                restStatus.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Restaurant>.Ok(restStatus, $"Restaurant set to {(restStatus.IsActive ? "ACTIVE" : "INACTIVE")}"));

            case "FEATURED":
                if (!request.Id.HasValue || !request.IsFeatured.HasValue)
                    return BadRequest(ApiResponse<Restaurant>.Fail("ID and IsFeatured flag are required"));
                var restFeat = await _db.Restaurants.FindAsync(request.Id.Value);
                if (restFeat == null) return NotFound(ApiResponse<Restaurant>.Fail("Restaurant not found"));
                restFeat.IsFeatured = request.IsFeatured.Value;
                restFeat.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Restaurant>.Ok(restFeat, $"Restaurant featured status updated"));

            case "DELETE":
                if (!request.Id.HasValue) return BadRequest(ApiResponse<Restaurant>.Fail("ID is required for DELETE"));
                var restDel = await _db.Restaurants.FindAsync(request.Id.Value);
                if (restDel == null) return NotFound(ApiResponse<Restaurant>.Fail("Restaurant not found"));
                restDel.IsActive = false;
                restDel.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Restaurant>.Ok(null!, "Restaurant deactivated"));

            default:
                return BadRequest(ApiResponse<Restaurant>.Fail($"Unknown action '{request.Action}'. Use ADD, EDIT, STATUS, FEATURED, or DELETE."));
        }
    }

    /// <summary>
    /// Driver Fleet List & Verification
    /// </summary>
    [HttpGet("drivers")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetDrivers()
    {
        var drivers = await _db.Drivers
            .Include(d => d.User)
            .Include(d => d.Vehicles)
            .Select(d => new
            {
                d.Id,
                d.UserId,
                DriverName = d.User.FullName ?? "Unnamed Driver",
                MobileNumber = d.User.MobileNumber,
                d.LicenseNumber,
                d.IsVerified,
                d.IsOnline,
                d.Rating,
                d.TotalRides,
                d.IsActive,
                Vehicle = d.Vehicles.Select(v => new { v.Type, v.RegistrationNumber, v.Make, v.Model }).FirstOrDefault()
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(drivers.Cast<object>().ToList()));
    }

    /// <summary>
    /// Driver Action Endpoint: VERIFY, STATUS
    /// </summary>
    [HttpPost("drivers")]
    public async Task<ActionResult<ApiResponse>> ManageDriver([FromBody] AdminDriverActionRequest request)
    {
        var driver = await _db.Drivers.FindAsync(request.DriverId);
        if (driver == null) return NotFound(ApiResponse.Fail("Driver not found"));

        switch (request.Action?.ToUpperInvariant())
        {
            case "VERIFY":
                if (!request.IsVerified.HasValue) return BadRequest(ApiResponse.Fail("IsVerified is required"));
                driver.IsVerified = request.IsVerified.Value;
                driver.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok($"Driver #{driver.Id} verification set to {driver.IsVerified}"));

            case "STATUS":
                if (!request.IsActive.HasValue) return BadRequest(ApiResponse.Fail("IsActive is required"));
                driver.IsActive = request.IsActive.Value;
                driver.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok($"Driver #{driver.Id} active status set to {driver.IsActive}"));

            default:
                return BadRequest(ApiResponse.Fail($"Unknown driver action '{request.Action}'. Use VERIFY or STATUS."));
        }
    }

    /// <summary>
    /// Coupons Management for Admin
    /// </summary>
    [HttpGet("coupons")]
    public async Task<ActionResult<ApiResponse<List<Coupon>>>> GetCoupons()
    {
        var coupons = await _db.Coupons.OrderByDescending(c => c.CreatedAt).ToListAsync();
        return Ok(ApiResponse<List<Coupon>>.Ok(coupons));
    }

    /// <summary>
    /// Coupon Action Endpoint: ADD, EDIT, DELETE, STATUS
    /// </summary>
    [HttpPost("coupons")]
    public async Task<ActionResult<ApiResponse<Coupon>>> ManageCoupon([FromBody] AdminCouponActionRequest request)
    {
        switch (request.Action?.ToUpperInvariant())
        {
            case "ADD":
                if (string.IsNullOrWhiteSpace(request.Code) || !request.DiscountValue.HasValue)
                    return BadRequest(ApiResponse<Coupon>.Fail("Code and DiscountValue are required"));

                var codeUpper = request.Code.Trim().ToUpperInvariant();
                var existingCoupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Code == codeUpper);
                if (existingCoupon != null)
                    return Conflict(ApiResponse<Coupon>.Fail("A coupon with this code already exists"));

                var module = CouponEngine.NormalizeModule(request.ApplicableModule);
                if (module is not ("FOOD" or "RIDE" or "MARKETPLACE" or "ALL"))
                    return BadRequest(ApiResponse<Coupon>.Fail("Applicable module must be FOOD, RIDE, MARKETPLACE, or ALL"));

                var coupon = new Coupon
                {
                    Code = codeUpper,
                    Title = request.Title?.Trim(),
                    Description = request.Description?.Trim(),
                    DiscountType = request.DiscountType ?? "PERCENTAGE",
                    DiscountValue = request.DiscountValue.Value,
                    MinOrderAmount = request.MinOrderAmount ?? 0,
                    MaxDiscount = request.MaxDiscount,
                    ApplicableModule = module,
                    ApplicableRestaurantId = request.ApplicableRestaurantId,
                    TotalUsageLimit = request.TotalUsageLimit,
                    PerUserLimit = request.PerUserLimit is > 0 ? request.PerUserLimit.Value : 1,
                    IsActive = request.IsActive ?? true,
                    StartDate = request.StartDate ?? DateTime.UtcNow,
                    ExpiryDate = request.ExpiryDate ?? DateTime.UtcNow.AddMonths(1),
                    CreatedAt = DateTime.UtcNow
                };
                _db.Coupons.Add(coupon);
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Coupon>.Ok(coupon, "Coupon created successfully"));

            case "STATUS":
                if (!request.Id.HasValue || !request.IsActive.HasValue)
                    return BadRequest(ApiResponse<Coupon>.Fail("ID and IsActive are required"));
                var cStatus = await _db.Coupons.FindAsync(request.Id.Value);
                if (cStatus == null) return NotFound(ApiResponse<Coupon>.Fail("Coupon not found"));
                cStatus.IsActive = request.IsActive.Value;
                cStatus.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Coupon>.Ok(cStatus, "Coupon status updated"));

            case "DELETE":
                if (!request.Id.HasValue) return BadRequest(ApiResponse<Coupon>.Fail("ID is required"));
                var cDel = await _db.Coupons.FindAsync(request.Id.Value);
                if (cDel == null) return NotFound(ApiResponse<Coupon>.Fail("Coupon not found"));
                cDel.IsActive = false;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Coupon>.Ok(null!, "Coupon deactivated"));

            default:
                return BadRequest(ApiResponse<Coupon>.Fail($"Unknown coupon action '{request.Action}'"));
        }
    }

    /// <summary>
    /// Banners Management for Admin
    /// </summary>
    [HttpGet("banners")]
    public async Task<ActionResult<ApiResponse<List<Banner>>>> GetBanners()
    {
        var banners = await _db.Banners.OrderBy(b => b.SortOrder).ToListAsync();
        return Ok(ApiResponse<List<Banner>>.Ok(banners));
    }

    /// <summary>
    /// Banner Action Endpoint: ADD, EDIT, DELETE, STATUS
    /// </summary>
    [HttpPost("banners")]
    [RequestSizeLimit(ImageByteProcessor.MaxUploadBytes)]
    public async Task<ActionResult<ApiResponse<Banner>>> ManageBanner()
    {
        AdminBannerActionRequest request;
        IFormFile? image = null;
        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync();
            image = form.Files.GetFile("image") ?? form.Files.FirstOrDefault();
            request = new AdminBannerActionRequest
            {
                Action = form["action"].FirstOrDefault() ?? "ADD",
                Id = long.TryParse(form["id"], out var id) ? id : null,
                Title = form["title"],
                Subtitle = form["subtitle"],
                ImageUrl = form["imageUrl"],
                CtaText = form["ctaText"],
                Module = form["module"],
                TargetType = form["targetType"],
                TargetId = form["targetId"],
                SortOrder = int.TryParse(form["sortOrder"], out var sort) ? sort : null,
                IsActive = bool.TryParse(form["isActive"], out var active) ? active : null
            };
            if (DateTime.TryParse(form["startDate"], out var start)) request.StartDate = DateTime.SpecifyKind(start, DateTimeKind.Utc);
            if (DateTime.TryParse(form["endDate"], out var end)) request.EndDate = DateTime.SpecifyKind(end, DateTimeKind.Utc);
        }
        else
        {
            request = await System.Text.Json.JsonSerializer.DeserializeAsync<AdminBannerActionRequest>(
                Request.Body,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AdminBannerActionRequest();
        }

        switch (request.Action?.ToUpperInvariant())
        {
            case "ADD":
            case "EDIT":
                if (string.IsNullOrWhiteSpace(request.Title) && request.Action?.ToUpperInvariant() == "ADD")
                    return BadRequest(ApiResponse<Banner>.Fail("Title is required"));

                string? imageUrl = request.ImageUrl?.Trim();
                if (image != null)
                {
                    if (image.Length == 0)
                        return BadRequest(ApiResponse<Banner>.Fail("Banner image was empty"));
                    await using var stream = image.OpenReadStream();
                    using var buffer = new MemoryStream();
                    await stream.CopyToAsync(buffer);
                    byte[] compressed;
                    byte[] thumb;
                    try
                    {
                        var result = ImageByteProcessor.CompressAndThumb(buffer.ToArray());
                        compressed = result.Main;
                        thumb = result.Thumbnail;
                    }
                    catch (InvalidImageException ex)
                    {
                        return BadRequest(ApiResponse<Banner>.Fail(ex.Message));
                    }
                    if (!long.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var owner) || owner <= 0)
                        return Unauthorized(ApiResponse<Banner>.Fail("Admin sign-in is required to store a banner image"));
                    var document = new AppDocument
                    {
                        DocumentNo = "DOC-" + Guid.NewGuid().ToString("N")[..16],
                        DocumentName = string.IsNullOrWhiteSpace(image.FileName) ? "banner.jpg" : Path.GetFileName(image.FileName),
                        BlobObject = compressed,
                        ThumbObject = thumb,
                        OwnerUserId = owner,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.Documents.Add(document);
                    imageUrl = $"/api/documents/{document.DocumentNo}/image";
                }

                var module = (request.Module ?? "HOME").Trim().ToUpperInvariant();
                if (module == "BAZAAR") module = "MARKETPLACE";
                if (module is not ("HOME" or "FOOD" or "RIDE" or "MARKETPLACE"))
                    return BadRequest(ApiResponse<Banner>.Fail("Target module must be HOME, FOOD, RIDE, or MARKETPLACE"));

                if (request.Action!.Equals("ADD", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(imageUrl))
                        return BadRequest(ApiResponse<Banner>.Fail("A banner image file or image URL is required"));
                    var banner = new Banner
                    {
                        Title = request.Title!.Trim(),
                        Subtitle = request.Subtitle?.Trim(),
                        ImageUrl = imageUrl,
                        CtaText = request.CtaText?.Trim(),
                        Module = module,
                        TargetType = request.TargetType,
                        TargetId = request.TargetId,
                        SortOrder = request.SortOrder ?? 0,
                        IsActive = request.IsActive ?? true,
                        StartDate = request.StartDate,
                        EndDate = request.EndDate,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.Banners.Add(banner);
                    await _db.SaveChangesAsync();
                    return Ok(ApiResponse<Banner>.Ok(banner, "Banner added successfully"));
                }

                if (!request.Id.HasValue) return BadRequest(ApiResponse<Banner>.Fail("ID is required for EDIT"));
                var existing = await _db.Banners.FindAsync(request.Id.Value);
                if (existing == null) return NotFound(ApiResponse<Banner>.Fail("Banner not found"));
                if (!string.IsNullOrWhiteSpace(request.Title)) existing.Title = request.Title.Trim();
                if (request.Subtitle != null) existing.Subtitle = request.Subtitle.Trim();
                if (!string.IsNullOrWhiteSpace(imageUrl)) existing.ImageUrl = imageUrl;
                if (request.CtaText != null) existing.CtaText = request.CtaText.Trim();
                existing.Module = module;
                if (request.TargetType != null) existing.TargetType = request.TargetType;
                if (request.TargetId != null) existing.TargetId = request.TargetId;
                if (request.SortOrder.HasValue) existing.SortOrder = request.SortOrder.Value;
                if (request.IsActive.HasValue) existing.IsActive = request.IsActive.Value;
                existing.StartDate = request.StartDate ?? existing.StartDate;
                existing.EndDate = request.EndDate ?? existing.EndDate;
                existing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Banner>.Ok(existing, "Banner updated"));

            case "STATUS":
                if (!request.Id.HasValue || !request.IsActive.HasValue)
                    return BadRequest(ApiResponse<Banner>.Fail("ID and IsActive are required"));
                var bStatus = await _db.Banners.FindAsync(request.Id.Value);
                if (bStatus == null) return NotFound(ApiResponse<Banner>.Fail("Banner not found"));
                bStatus.IsActive = request.IsActive.Value;
                bStatus.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Banner>.Ok(bStatus, "Banner status updated"));

            case "DELETE":
                if (!request.Id.HasValue) return BadRequest(ApiResponse<Banner>.Fail("ID is required"));
                var bDel = await _db.Banners.FindAsync(request.Id.Value);
                if (bDel == null) return NotFound(ApiResponse<Banner>.Fail("Banner not found"));
                bDel.IsActive = false;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse<Banner>.Ok(null!, "Banner deactivated"));

            default:
                return BadRequest(ApiResponse<Banner>.Fail($"Unknown banner action '{request.Action}'"));
        }
    }

    /// <summary>
    /// Food Orders List for Admin Monitoring
    /// </summary>
    [HttpGet("food-orders")]
    public async Task<ActionResult<ApiResponse<List<AdminFoodOrderDto>>>> GetFoodOrders([FromQuery] string? status, [FromQuery] string? search)
    {
        var query = _db.FoodOrders
            .Include(o => o.Restaurant)
            .Include(o => o.User)
            .Include(o => o.Items)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            query = query.Where(o => o.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(o => o.OrderNumber.Contains(term) || (o.Restaurant != null && o.Restaurant.Name.Contains(term)) || (o.User != null && (o.User.FullName!.Contains(term) || o.User.MobileNumber.Contains(term))));
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .Select(o => new AdminFoodOrderDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                RestaurantId = o.RestaurantId,
                RestaurantName = o.Restaurant != null ? o.Restaurant.Name : "Restaurant",
                UserId = o.UserId,
                CustomerName = o.User != null ? o.User.FullName ?? "Customer" : "Customer",
                CustomerPhone = o.User != null ? o.User.MobileNumber : "",
                ItemTotal = o.SubTotal,
                DeliveryFee = o.DeliveryFee,
                DiscountAmount = o.DiscountAmount,
                GrandTotal = o.GrandTotal,
                Status = o.Status,
                PaymentMethod = o.PaymentMethod ?? "CASH",
                PaymentStatus = o.PaymentStatus,
                CreatedAt = o.CreatedAt,
                ItemsCount = o.Items.Count
            })
            .ToListAsync();

        return Ok(ApiResponse<List<AdminFoodOrderDto>>.Ok(orders));
    }

    /// <summary>
    /// Rides List for Admin Monitoring
    /// </summary>
    [HttpGet("rides")]
    public async Task<ActionResult<ApiResponse<List<AdminRideDto>>>> GetRides([FromQuery] string? status, [FromQuery] string? search)
    {
        var query = _db.Rides
            .Include(r => r.User)
            .Include(r => r.Driver)
                .ThenInclude(d => d!.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            query = query.Where(r => r.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r => r.RideNumber.Contains(term) || (r.User != null && (r.User.FullName!.Contains(term) || r.User.MobileNumber.Contains(term))));
        }

        var rides = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .Select(r => new AdminRideDto
            {
                Id = r.Id,
                RideNumber = r.RideNumber,
                VehicleType = r.VehicleType,
                PickupAddress = r.PickupAddress,
                DropoffAddress = r.DropoffAddress,
                DistanceKm = r.DistanceKm ?? 0m,
                EstimatedFare = r.EstimatedFare,
                ActualFare = r.ActualFare,
                Status = r.Status,
                PaymentMethod = r.PaymentMethod ?? "CASH",
                PaymentStatus = r.PaymentStatus ?? "PENDING",
                CustomerName = r.User != null ? r.User.FullName ?? "Passenger" : "Passenger",
                CustomerPhone = r.User != null ? r.User.MobileNumber : "",
                DriverName = r.Driver != null && r.Driver.User != null ? r.Driver.User.FullName : null,
                DriverPhone = r.Driver != null && r.Driver.User != null ? r.Driver.User.MobileNumber : null,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<AdminRideDto>>.Ok(rides));
    }

    /// <summary>
    /// Marketplace Listings for Admin Moderation
    /// </summary>
    [HttpGet("marketplace/listings")]
    public async Task<ActionResult<ApiResponse<List<ListingSummaryDto>>>> GetMarketplaceListings([FromQuery] string? status, [FromQuery] string? search)
    {
        var query = _db.MarketplaceListings
            .Include(l => l.Category)
            .Include(l => l.Images)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            query = query.Where(l => l.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(l => l.Title.Contains(term) || (l.Location != null && l.Location.Contains(term)));
        }

        var listings = await query
            .OrderByDescending(l => l.CreatedAt)
            .Take(50)
            .Select(l => new ListingSummaryDto
            {
                Id = l.Id,
                Title = l.Title,
                Price = l.Price,
                Condition = l.Condition,
                Location = l.Location,
                PrimaryImageUrl = l.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
                IsFeatured = l.IsFeatured,
                ViewCount = l.ViewCount,
                Status = l.Status,
                CreatedAt = l.CreatedAt,
                CategoryId = l.CategoryId,
                CategoryName = l.Category != null ? l.Category.Name : "General",
                IsFavorite = false
            })
            .ToListAsync();

        return Ok(ApiResponse<List<ListingSummaryDto>>.Ok(listings));
    }

    /// <summary>
    /// Marketplace Listing Action for Admin Moderation: STATUS, FEATURED, DELETE
    /// </summary>
    [HttpPost("marketplace/listings")]
    public async Task<ActionResult<ApiResponse>> ManageMarketplaceListing([FromBody] AdminListingActionRequest request)
    {
        var listing = await _db.MarketplaceListings.FindAsync(request.ListingId);
        if (listing == null)
            return NotFound(ApiResponse.Fail("Listing not found"));

        switch (request.Action?.ToUpperInvariant())
        {
            case "STATUS":
                if (string.IsNullOrWhiteSpace(request.Status))
                    return BadRequest(ApiResponse.Fail("Status is required"));
                listing.Status = request.Status.Trim().ToUpperInvariant();
                listing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok($"Listing status set to {listing.Status}"));

            case "FEATURED":
                if (!request.IsFeatured.HasValue)
                    return BadRequest(ApiResponse.Fail("IsFeatured is required"));
                listing.IsFeatured = request.IsFeatured.Value;
                listing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok($"Listing featured set to {listing.IsFeatured}"));

            case "DELETE":
                listing.IsActive = false;
                listing.Status = ListingStatus.Removed;
                listing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(ApiResponse.Ok("Listing deactivated"));

            default:
                return BadRequest(ApiResponse.Fail($"Unknown action '{request.Action}'. Use STATUS, FEATURED, or DELETE."));
        }
    }

    /// <summary>
    /// System Settings for Admin Config
    /// </summary>
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<List<AdminSettingDto>>>> GetSettings()
    {
        var settings = await _db.AppSettings
            .Select(s => new AdminSettingDto
            {
                Key = s.SettingKey,
                Value = s.SettingValue ?? string.Empty,
                Description = s.Description ?? string.Empty,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync();

        if (!settings.Any())
        {
            var defaultSettings = new List<AppSetting>
            {
                new AppSetting { SettingKey = "platform_commission_percent", SettingValue = "15", Description = "Default platform commission on vendor orders (%)", UpdatedAt = DateTime.UtcNow },
                new AppSetting { SettingKey = "driver_commission_percent", SettingValue = "20", Description = "Platform cut on ride fares (%)", UpdatedAt = DateTime.UtcNow },
                new AppSetting { SettingKey = "surge_pricing_multiplier", SettingValue = "1.0", Description = "Global ride surge multiplier", UpdatedAt = DateTime.UtcNow },
                new AppSetting { SettingKey = "free_delivery_threshold", SettingValue = "500", Description = "Order value for free delivery in INR", UpdatedAt = DateTime.UtcNow },
                new AppSetting { SettingKey = "maintenance_mode", SettingValue = "false", Description = "App maintenance downtime mode (true/false)", UpdatedAt = DateTime.UtcNow }
            };
            _db.AppSettings.AddRange(defaultSettings);
            await _db.SaveChangesAsync();

            settings = defaultSettings.Select(s => new AdminSettingDto
            {
                Key = s.SettingKey,
                Value = s.SettingValue ?? string.Empty,
                Description = s.Description ?? string.Empty,
                UpdatedAt = s.UpdatedAt
            }).ToList();
        }

        return Ok(ApiResponse<List<AdminSettingDto>>.Ok(settings));
    }

    /// <summary>
    /// Update or Add App Setting
    /// </summary>
    [HttpPost("settings")]
    public async Task<ActionResult<ApiResponse>> UpdateSetting([FromBody] UpdateSettingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Key))
            return BadRequest(ApiResponse.Fail("Setting key is required"));

        var setting = await _db.AppSettings.FirstOrDefaultAsync(s => s.SettingKey == request.Key.Trim());
        if (setting == null)
        {
            setting = new AppSetting
            {
                SettingKey = request.Key.Trim(),
                SettingValue = request.Value?.Trim(),
                Description = request.Description?.Trim(),
                UpdatedAt = DateTime.UtcNow
            };
            _db.AppSettings.Add(setting);
        }
        else
        {
            setting.SettingValue = request.Value?.Trim();
            if (!string.IsNullOrWhiteSpace(request.Description))
                setting.Description = request.Description.Trim();
            setting.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok($"Setting '{setting.SettingKey}' updated successfully"));
    }

    /// <summary>
    /// Executive Business Report & Platform Analytics
    /// </summary>
    [HttpGet("reports")]
    public async Task<ActionResult<ApiResponse<AdminReportDto>>> GetReports()
    {
        var foodSales = await _db.FoodOrders.Where(o => o.Status == OrderStatus.Delivered).SumAsync(o => (decimal?)o.GrandTotal) ?? 0;
        var rideFares = await _db.Rides.Where(r => r.Status == RideStatus.Completed).SumAsync(r => (decimal?)r.ActualFare) ?? 0;
        var totalOrders = await _db.FoodOrders.CountAsync(o => o.Status == OrderStatus.Delivered);
        var totalRides = await _db.Rides.CountAsync(r => r.Status == RideStatus.Completed);

        decimal platformEarnings = Math.Round(foodSales * 0.15m + rideFares * 0.20m, 2);

        var foodByRestaurant = await _db.FoodOrders
            .Where(o => o.Status == OrderStatus.Delivered)
            .GroupBy(o => o.RestaurantId)
            .Select(g => new { Id = g.Key, Revenue = g.Sum(o => o.GrandTotal), Count = g.Count() })
            .ToListAsync();

        var topRestaurants = (await _db.Restaurants
            .Where(r => r.IsActive)
            .OrderByDescending(r => r.Rating)
            .Take(5)
            .ToListAsync())
            .Select(r =>
            {
                var sales = foodByRestaurant.FirstOrDefault(s => s.Id == r.Id);
                return new TopPerformerDto
                {
                    Id = r.Id,
                    Name = r.Name,
                    Revenue = sales?.Revenue ?? 0,
                    TotalCount = sales?.Count ?? 0,
                    Rating = r.Rating
                };
            })
            .ToList();

        var fareByDriver = await _db.Rides
            .Where(r => r.Status == RideStatus.Completed && r.DriverId != null)
            .GroupBy(r => r.DriverId)
            .Select(g => new { Id = g.Key, Revenue = g.Sum(r => r.ActualFare ?? 0) })
            .ToListAsync();

        var topDrivers = (await _db.Drivers
            .Include(d => d.User)
            .Where(d => d.IsActive)
            .OrderByDescending(d => d.Rating)
            .Take(5)
            .ToListAsync())
            .Select(d => new TopPerformerDto
            {
                Id = d.Id,
                Name = d.User.FullName ?? "Driver",
                Revenue = fareByDriver.FirstOrDefault(f => f.Id == d.Id)?.Revenue ?? 0,
                TotalCount = d.TotalRides,
                Rating = d.Rating
            })
            .ToList();

        var report = new AdminReportDto
        {
            TotalFoodSales = foodSales,
            TotalRideFares = rideFares,
            TotalPlatformEarnings = platformEarnings,
            TotalCompletedOrders = totalOrders,
            TotalCompletedRides = totalRides,
            TopRestaurants = topRestaurants,
            TopDrivers = topDrivers
        };

        return Ok(ApiResponse<AdminReportDto>.Ok(report));
    }

    /// <summary>
    /// Broadcast Announcement / Push Notification
    /// </summary>
    [HttpPost("notifications/broadcast")]
    public async Task<ActionResult<ApiResponse>> BroadcastNotification([FromBody] BroadcastNotificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(ApiResponse.Fail("Title and Message are required"));

        var query = _db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.TargetRole))
        {
            var roleName = request.TargetRole.Trim().ToUpperInvariant();
            query = query.Where(u => u.UserRoles.Any(ur => ur.Role.Name == roleName));
        }

        var targetUsers = await query.Take(200).ToListAsync();

        foreach (var u in targetUsers)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = u.Id,
                Title = request.Title.Trim(),
                Body = request.Message.Trim(),
                Type = "SYSTEM",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok($"Notification broadcasted to {targetUsers.Count} recipient(s)"));
    }

    /// <summary>
    /// Clean up dummy test data and ensure phone numbers on real restaurants
    /// </summary>
    [HttpPost("cleanup-dummy-data")]
    public async Task<ActionResult<ApiResponse>> CleanupDummyData()
    {
        // 1. Clean up test restaurants created during automated tests
        var testRestaurants = await _db.Restaurants
            .Where(r => r.Name.StartsWith("Playwright") || r.Name.StartsWith("DB Test"))
            .ToListAsync();

        if (testRestaurants.Any())
        {
            var testRestIds = testRestaurants.Select(r => r.Id).ToList();

            var testItems = await _db.FoodItems.Where(f => testRestIds.Contains(f.RestaurantId)).ToListAsync();
            _db.FoodItems.RemoveRange(testItems);

            var testCats = await _db.RestaurantCategories.Where(c => testRestIds.Contains(c.RestaurantId)).ToListAsync();
            _db.RestaurantCategories.RemoveRange(testCats);

            var testOrders = await _db.FoodOrders.Where(o => testRestIds.Contains(o.RestaurantId)).ToListAsync();
            _db.FoodOrders.RemoveRange(testOrders);

            _db.Restaurants.RemoveRange(testRestaurants);
            await _db.SaveChangesAsync();
        }

        // 2. Set realistic verified phone numbers & addresses for active real restaurants
        var restaurants = await _db.Restaurants.Where(r => r.IsActive).ToListAsync();
        foreach (var r in restaurants)
        {
            if (r.Name.Contains("Meghana", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+919845012345";
                r.AddressLine = "5th Block, Koramangala";
                r.City = "Bengaluru";
            }
            else if (r.Name.Contains("Haldiram", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+911141517777";
                r.AddressLine = "Barakhamba Road, Connaught Place";
                r.City = "New Delhi";
            }
            else if (r.Name.Contains("Burger King", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+919820054321";
                r.AddressLine = "Sector 18 Market";
                r.City = "Noida";
            }
            else if (r.Name.Contains("Dosa Plaza", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+919833067890";
                r.AddressLine = "Indiranagar 100ft Road";
                r.City = "Bengaluru";
            }
            else if (r.Name.Contains("Pizza Hub", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+919876511223";
                r.AddressLine = "Chappan Dukan";
                r.City = "Indore";
            }
            else if (r.Name.Contains("Roll Junction", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+919810088990";
                r.AddressLine = "Hauz Khas Village";
                r.City = "New Delhi";
            }
            else if (r.Name.Contains("Sweet Tooth", StringComparison.OrdinalIgnoreCase))
            {
                r.Phone = "+919899044556";
                r.AddressLine = "Khan Market";
                r.City = "New Delhi";
            }
            else if (string.IsNullOrWhiteSpace(r.Phone))
            {
                r.Phone = "+919876543210";
            }
        }
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("Dummy test restaurants removed and real restaurant phone numbers updated successfully."));
    }
}
