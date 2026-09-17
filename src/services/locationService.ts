import * as Location from 'expo-location';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
}

export interface WatchLocationOptions {
  accuracy?: Location.Accuracy;
  timeInterval?: number;
  distanceInterval?: number;
}

export class LocationService {
  public static readonly defaultLocation: LocationCoordinates = {
    latitude: 28.6304,
    longitude: 77.2177,
    formattedAddress: 'Connaught Place, Central Delhi',
    accuracy: 10,
    timestamp: Date.now(),
  };

  private activeWatcherSubscription: Location.LocationSubscription | null = null;

  /**
   * Check current foreground location permission status without prompting user
   */
  async checkPermission(): Promise<LocationPermissionStatus> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) return 'granted';
      if (status === Location.PermissionStatus.DENIED) return 'denied';
      return 'undetermined';
    } catch (error) {
      console.warn('[LocationService] checkPermission error:', error);
      return 'undetermined';
    }
  }

  /**
   * Request foreground location permission from the user
   */
  async requestPermission(): Promise<LocationPermissionStatus> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) return 'granted';
      if (status === Location.PermissionStatus.DENIED) return 'denied';
      return 'undetermined';
    } catch (error) {
      console.warn('[LocationService] requestPermission error:', error);
      return 'denied';
    }
  }

  /**
   * Check if hardware GPS / location services are enabled on the device
   */
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.warn('[LocationService] isLocationServicesEnabled error:', error);
      return false;
    }
  }

  /**
   * Reverse geocode coordinates to a human-readable street address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        const parts = [
          addr.name,
          addr.street,
          addr.subregion || addr.district || addr.city,
          addr.region,
        ].filter(Boolean);
        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    } catch (error) {
      console.warn('[LocationService] reverseGeocode error:', error);
      return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    }
  }

  /**
   * Get current device foreground GPS location with timeout protection and address resolution
   */
  async getCurrentLocation(options?: {
    accuracy?: Location.Accuracy;
    timeoutMs?: number;
  }): Promise<LocationCoordinates> {
    const timeoutMs = options?.timeoutMs ?? 10000;
    const accuracy = options?.accuracy ?? Location.Accuracy.Balanced;

    const enabled = await this.isLocationServicesEnabled();
    if (!enabled) {
      console.warn('[LocationService] Location services are disabled. Using fallback location.');
      return LocationService.defaultLocation;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      console.warn('[LocationService] Permission not granted. Using fallback location.');
      return LocationService.defaultLocation;
    }

    let timeoutId: any;
    try {
      const locationPromise = Location.getCurrentPositionAsync({ accuracy });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Location request timed out')), timeoutMs);
      });

      const position = await Promise.race([locationPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const { latitude, longitude, accuracy: posAccuracy, altitude, speed, heading } = position.coords;

      const formattedAddress = await this.reverseGeocode(latitude, longitude);

      return {
        latitude,
        longitude,
        formattedAddress,
        accuracy: posAccuracy,
        altitude,
        speed,
        heading,
        timestamp: position.timestamp,
      };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[LocationService] getCurrentLocation failed, returning fallback:', error);
      return LocationService.defaultLocation;
    }
  }

  /**
   * Watch location changes continuously while in foreground.
   * Returns a cleanup function that must be called to unsubscribe.
   */
  async watchLocation(
    callback: (location: LocationCoordinates) => void,
    options?: WatchLocationOptions
  ): Promise<() => void> {
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      console.warn('[LocationService] Cannot watch location: permission denied');
      return () => {};
    }

    try {
      // Clean up any existing watcher before starting a new one
      if (this.activeWatcherSubscription) {
        this.activeWatcherSubscription.remove();
        this.activeWatcherSubscription = null;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
          timeInterval: options?.timeInterval ?? 5000,
          distanceInterval: options?.distanceInterval ?? 10,
        },
        async (position) => {
          const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
          const formattedAddress = await this.reverseGeocode(latitude, longitude);

          callback({
            latitude,
            longitude,
            formattedAddress,
            accuracy,
            altitude,
            speed,
            heading,
            timestamp: position.timestamp,
          });
        }
      );

      this.activeWatcherSubscription = subscription;

      return () => {
        subscription.remove();
        if (this.activeWatcherSubscription === subscription) {
          this.activeWatcherSubscription = null;
        }
      };
    } catch (error) {
      console.warn('[LocationService] watchLocation error:', error);
      return () => {};
    }
  }

  /**
   * Stop any active location watcher
   */
  stopWatching(): void {
    if (this.activeWatcherSubscription) {
      this.activeWatcherSubscription.remove();
      this.activeWatcherSubscription = null;
    }
  }

  /**
   * Calculate Haversine distance in kilometers between two GPS points
   * Applies 1.25x factor for urban city layout (matching backend routing)
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
