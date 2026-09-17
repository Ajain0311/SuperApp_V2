export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

class LocationService {
  public static readonly defaultLocation: LocationCoordinates = {
    latitude: 12.9716,
    longitude: 77.5946,
    formattedAddress: 'Indiranagar 100ft Road, Bengaluru',
  };

  /**
   * Calculate Haversine distance in kilometers between two GPS points
   * Applies 1.25x factor for urban city layout (matching Flutter backend)
   */
  calculateDistanceKm(startLat: number, startLng: number, endLat: number, endLng: number): number {
    const earthRadiusKm = 6371.0;
    const dLat = this.degreesToRadians(endLat - startLat);
    const dLon = this.degreesToRadians(endLng - startLng);

    const lat1 = this.degreesToRadians(startLat);
    const lat2 = this.degreesToRadians(endLat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Multiply by 1.25 for urban city road layout
    return Number((earthRadiusKm * c * 1.25).toFixed(1));
  }

  /**
   * Estimate driving duration in minutes (22 km/h average urban speed)
   */
  estimateDurationMinutes(distanceKm: number): number {
    return Math.max(4, Math.round((distanceKm / 22.0) * 60));
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180.0);
  }
}

export const locationService = new LocationService();
