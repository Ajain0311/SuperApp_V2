namespace SuperApp.API.Services;

/// <summary>
/// Resolves the phone customers/captains should dial for a restaurant.
/// Prefer a linked RESTAURANT_OWNER mobile over restaurants.phone when that
/// stored phone belongs to a non-owner (seed/mismatched data).
/// </summary>
public static class RestaurantContactResolver
{
    public static string NormalizeLast10(string? mobile)
    {
        if (string.IsNullOrWhiteSpace(mobile))
            return string.Empty;

        var digits = new string(mobile.Where(char.IsDigit).ToArray());
        if (digits.Length <= 10)
            return digits;
        return digits[^10..];
    }

    /// <param name="restaurantPhone">Value from restaurants.phone</param>
    /// <param name="ownerMobiles">
    /// Active linked owner mobiles for this restaurant, oldest-first.
    /// Each item is (MobileNumber, FullName).
    /// </param>
    public static string? ResolveOwnerPhone(
        string? restaurantPhone,
        IReadOnlyList<(string MobileNumber, string? FullName)> ownerMobiles)
    {
        var trimmedRestaurantPhone = string.IsNullOrWhiteSpace(restaurantPhone)
            ? null
            : restaurantPhone.Trim();

        if (ownerMobiles == null || ownerMobiles.Count == 0)
            return trimmedRestaurantPhone;

        var phoneKey = NormalizeLast10(trimmedRestaurantPhone);
        if (phoneKey.Length >= 10)
        {
            foreach (var owner in ownerMobiles)
            {
                if (NormalizeLast10(owner.MobileNumber) == phoneKey)
                    return string.IsNullOrWhiteSpace(owner.MobileNumber)
                        ? trimmedRestaurantPhone
                        : owner.MobileNumber.Trim();
            }
        }

        // restaurants.phone did not match any linked owner (common with seed numbers
        // that belong to CUSTOMER-only users). Prefer a stable non-load-test owner.
        foreach (var owner in ownerMobiles)
        {
            if (string.IsNullOrWhiteSpace(owner.MobileNumber))
                continue;
            if (!string.IsNullOrWhiteSpace(owner.FullName)
                && owner.FullName.Contains(" run-", StringComparison.OrdinalIgnoreCase))
                continue;
            return owner.MobileNumber.Trim();
        }

        var fallbackOwner = ownerMobiles.FirstOrDefault(o => !string.IsNullOrWhiteSpace(o.MobileNumber));
        if (!string.IsNullOrWhiteSpace(fallbackOwner.MobileNumber))
            return fallbackOwner.MobileNumber.Trim();

        return trimmedRestaurantPhone;
    }
}
