namespace SuperApp.API.Services;

public class MockMapService : IMapService
{
    private const double EarthRadiusKm = 6371.0;
    private const double UrbanRoadFactor = 1.25; // Compensates for city road turns

    public double CalculateDistanceKm(decimal startLat, decimal startLng, decimal endLat, decimal endLng)
    {
        double lat1 = (double)startLat * Math.PI / 180.0;
        double lon1 = (double)startLng * Math.PI / 180.0;
        double lat2 = (double)endLat * Math.PI / 180.0;
        double lon2 = (double)endLng * Math.PI / 180.0;

        double dLat = lat2 - lat1;
        double dLon = lon2 - lon1;

        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(lat1) * Math.Cos(lat2) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        double straightDistance = EarthRadiusKm * c;

        // Apply urban road factor
        double roadDistance = straightDistance * UrbanRoadFactor;
        return Math.Round(Math.Max(roadDistance, 1.0), 2);
    }

    public Task<RouteEstimationResult> EstimateRouteAsync(decimal startLat, decimal startLng, decimal endLat, decimal endLng)
    {
        var distanceKm = CalculateDistanceKm(startLat, startLng, endLat, endLng);
        // Average speed 22 km/h in Bengaluru/traffic
        int durationMinutes = Math.Max(5, (int)Math.Round((distanceKm / 22.0) * 60));

        var result = new RouteEstimationResult
        {
            DistanceKm = distanceKm,
            EstimatedDurationMinutes = durationMinutes,
            Polyline = $"{startLat},{startLng}|{(startLat + endLat) / 2},{(startLng + endLng) / 2}|{endLat},{endLng}",
            FormattedPickup = "Pickup Location",
            FormattedDropoff = "Drop Location"
        };

        return Task.FromResult(result);
    }

    public Task<string> ReverseGeocodeAsync(decimal latitude, decimal longitude)
    {
        // Mock landmark detection based on quadrant
        string location;
        if (latitude > 12.95m && longitude > 77.60m)
            location = "Indiranagar 100ft Road, Bengaluru, Karnataka 560038";
        else if (latitude > 12.92m && longitude > 77.62m)
            location = "Koramangala 5th Block, Bengaluru, Karnataka 560095";
        else if (latitude > 12.90m && longitude > 77.64m)
            location = "HSR Layout Sector 3, Bengaluru, Karnataka 560102";
        else
            location = "MG Road Central, Bengaluru, Karnataka 560001";

        return Task.FromResult(location);
    }
}
