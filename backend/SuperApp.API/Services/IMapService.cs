namespace SuperApp.API.Services;

public class RouteEstimationResult
{
    public double DistanceKm { get; set; }
    public int EstimatedDurationMinutes { get; set; }
    public string Polyline { get; set; } = string.Empty;
    public string FormattedPickup { get; set; } = string.Empty;
    public string FormattedDropoff { get; set; } = string.Empty;
}

public interface IMapService
{
    double CalculateDistanceKm(decimal startLat, decimal startLng, decimal endLat, decimal endLng);
    Task<RouteEstimationResult> EstimateRouteAsync(decimal startLat, decimal startLng, decimal endLat, decimal endLng);
    Task<string> ReverseGeocodeAsync(decimal latitude, decimal longitude);
}
