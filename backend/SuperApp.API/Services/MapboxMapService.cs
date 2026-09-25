using System.Globalization;
using System.Text.Json;
using NetTopologySuite.Geometries;

namespace SuperApp.API.Services;

/// <summary>
/// Mapbox Directions + Geocoding implementation of IMapService.
/// Falls back to Haversine (+ urban factor) when Mapbox is unreachable.
/// </summary>
public class MapboxMapService : IMapService
{
    private readonly HttpClient _http;
    private readonly string _accessToken;
    private readonly ILogger<MapboxMapService> _logger;
    private readonly MockMapService _fallback = new();
    private static readonly GeometryFactory GeometryFactory = new(new PrecisionModel(), 4326);

    public MapboxMapService(HttpClient http, IConfiguration configuration, ILogger<MapboxMapService> logger)
    {
        _http = http;
        _logger = logger;
        _accessToken =
            Environment.GetEnvironmentVariable("MAPBOX_ACCESS_TOKEN")
            ?? configuration["Mapbox:AccessToken"]
            ?? string.Empty;
    }

    public double CalculateDistanceKm(decimal startLat, decimal startLng, decimal endLat, decimal endLng)
    {
        // Lightweight NTS distance (degrees → meters via Geographic approximation using Haversine fallback).
        // Prefer Haversine urban factor for road-ish estimates when Directions is not called.
        return _fallback.CalculateDistanceKm(startLat, startLng, endLat, endLng);
    }

    public async Task<RouteEstimationResult> EstimateRouteAsync(
        decimal startLat,
        decimal startLng,
        decimal endLat,
        decimal endLng)
    {
        if (string.IsNullOrWhiteSpace(_accessToken))
        {
            return await _fallback.EstimateRouteAsync(startLat, startLng, endLat, endLng);
        }

        try
        {
            var coords =
                $"{Fmt(startLng)},{Fmt(startLat)};{Fmt(endLng)},{Fmt(endLat)}";
            var url =
                $"https://api.mapbox.com/directions/v5/mapbox/driving/{coords}" +
                $"?geometries=polyline&overview=full&access_token={Uri.EscapeDataString(_accessToken)}";

            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Mapbox Directions failed with {Status}", response.StatusCode);
                return await _fallback.EstimateRouteAsync(startLat, startLng, endLat, endLng);
            }

            await using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;
            if (!root.TryGetProperty("routes", out var routes) || routes.GetArrayLength() == 0)
            {
                return await _fallback.EstimateRouteAsync(startLat, startLng, endLat, endLng);
            }

            var route = routes[0];
            var distanceMeters = route.GetProperty("distance").GetDouble();
            var durationSeconds = route.GetProperty("duration").GetDouble();
            var polyline = route.TryGetProperty("geometry", out var geom) ? geom.GetString() ?? string.Empty : string.Empty;

            // Touch NTS so the package is exercised for future PostGIS work.
            _ = GeometryFactory.CreatePoint(new Coordinate((double)startLng, (double)startLat));
            _ = GeometryFactory.CreatePoint(new Coordinate((double)endLng, (double)endLat));

            return new RouteEstimationResult
            {
                DistanceKm = Math.Round(Math.Max(distanceMeters / 1000.0, 0.5), 2),
                EstimatedDurationMinutes = Math.Max(3, (int)Math.Round(durationSeconds / 60.0)),
                Polyline = polyline ?? string.Empty,
                FormattedPickup = "Pickup",
                FormattedDropoff = "Dropoff",
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Mapbox Directions error; using Haversine fallback");
            return await _fallback.EstimateRouteAsync(startLat, startLng, endLat, endLng);
        }
    }

    public async Task<string> ReverseGeocodeAsync(decimal latitude, decimal longitude)
    {
        if (string.IsNullOrWhiteSpace(_accessToken))
        {
            return await _fallback.ReverseGeocodeAsync(latitude, longitude);
        }

        try
        {
            var url =
                $"https://api.mapbox.com/geocoding/v5/mapbox.places/{Fmt(longitude)},{Fmt(latitude)}.json" +
                $"?limit=1&language=en&access_token={Uri.EscapeDataString(_accessToken)}";

            using var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                return await _fallback.ReverseGeocodeAsync(latitude, longitude);
            }

            await using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            if (!doc.RootElement.TryGetProperty("features", out var features) || features.GetArrayLength() == 0)
            {
                return await _fallback.ReverseGeocodeAsync(latitude, longitude);
            }

            var placeName = features[0].GetProperty("place_name").GetString();
            return string.IsNullOrWhiteSpace(placeName)
                ? await _fallback.ReverseGeocodeAsync(latitude, longitude)
                : placeName;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Mapbox reverse geocode error; using mock fallback");
            return await _fallback.ReverseGeocodeAsync(latitude, longitude);
        }
    }

    private static string Fmt(decimal value) =>
        value.ToString(CultureInfo.InvariantCulture);
}
