import * as Location from 'expo-location';
import { mapboxService } from './mapboxService';

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
  isFallback?: boolean;
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
    isFallback: true,
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
    // 1. Try Mapbox Geocoding first for high-detail village, mohalla, and landmark names (e.g. Hiran Magri)
    try {
      if (mapboxService.isConfigured()) {
        const mapboxPlace = await mapboxService.reverseGeocode(latitude, longitude);
        if (mapboxPlace?.address && !mapboxPlace.address.includes('°')) {
          return mapboxPlace.address;
        }
      }
    } catch (mapboxErr) {
      console.debug?.('[LocationService] mapbox reverseGeocode fallback to native geocode:', mapboxErr);
    }

    // 2. Fallback to device native reverse geocode (expo-location)
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        // Filter out broad administrative divisions like 'Udaipur Division' so local names take priority
        const sanitizePart = (val: string | null | undefined): string | null => {
          if (!val) return null;
          const trimmed = val.trim();
          if (/division/i.test(trimmed)) return null;
          return trimmed;
        };

        const parts = [
          sanitizePart(addr.name),
          sanitizePart(addr.street),
          sanitizePart(addr.district) || sanitizePart(addr.subregion) || sanitizePart(addr.city),
          sanitizePart(addr.city !== addr.district ? addr.city : null),
          sanitizePart(addr.postalCode),
        ].filter(Boolean);

        if (parts.length > 0) {
          const deduped: string[] = [];
          for (const p of parts as string[]) {
            if (!deduped.some((d) => d.toLowerCase() === p.toLowerCase())) {
              deduped.push(p);
            }
          }
          return deduped.join(', ');
        }
      }
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.warn('[LocationService] reverseGeocode error:', error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  }

  /**
   * Get current device foreground GPS location with timeout protection and address resolution
   */
  async getCurrentLocation(options?: {
    accuracy?: Location.Accuracy;
    timeoutMs?: number;
    throwOnError?: boolean;
    maxAgeMs?: number;
    maxAccuracyMeters?: number;
    forceFresh?: boolean;
  }): Promise<LocationCoordinates> {
    const timeoutMs = options?.timeoutMs ?? 10000;
    const accuracy = options?.accuracy ?? Location.Accuracy.Balanced;
    const throwOnError = options?.throwOnError ?? false;
    const maxAgeMs = options?.maxAgeMs ?? 60000;
    const maxAccuracyMeters = options?.maxAccuracyMeters ?? 100;
    const forceFresh = options?.forceFresh ?? false;

    const enabled = await this.isLocationServicesEnabled();
    if (!enabled) {
      console.warn('[LocationService] Location services are disabled.');
      if (throwOnError) {
        throw new Error('Location services are disabled on your device. Please turn on GPS.');
      }
      return LocationService.defaultLocation;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      console.warn('[LocationService] Permission not granted.');
      if (throwOnError) {
        throw new Error('Location permission denied.');
      }
      return LocationService.defaultLocation;
    }

    let timeoutId: any;
    try {
      let position: Location.LocationObject | null = null;
      if (!forceFresh && typeof Location.getLastKnownPositionAsync === 'function') {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: maxAgeMs,
            requiredAccuracy: maxAccuracyMeters,
          });
          if (
            lastKnown &&
            Date.now() - lastKnown.timestamp <= maxAgeMs &&
            (lastKnown.coords.accuracy == null || lastKnown.coords.accuracy <= maxAccuracyMeters)
          ) {
            position = lastKnown;
          }
        } catch (lastKnownErr) {
          console.debug?.('[LocationService] getLastKnownPositionAsync skipped:', lastKnownErr);
        }
      }

      if (!position) {
        const locationPromise = Location.getCurrentPositionAsync({ accuracy });
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Location request timed out')), timeoutMs);
        });

        position = await Promise.race([locationPromise, timeoutPromise]);
      }

      if (timeoutId) clearTimeout(timeoutId);

      const { latitude, longitude, accuracy: posAccuracy, altitude, speed, heading } = position.coords;

      // Validate accuracy threshold if reported
      if (posAccuracy != null && maxAccuracyMeters && posAccuracy > maxAccuracyMeters) {
        console.warn(`[LocationService] GPS accuracy ${posAccuracy}m exceeds threshold ${maxAccuracyMeters}m`);
      }

      // Reverse geocode with graceful coordinate fallback so valid coordinates are never discarded
      let formattedAddress = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
      try {
        const reverseResolved = await this.reverseGeocode(latitude, longitude);
        if (reverseResolved && reverseResolved.trim()) {
          formattedAddress = reverseResolved;
        }
      } catch (geoErr) {
        console.warn('[LocationService] Reverse geocode failed, using coordinates:', geoErr);
      }

      return {
        latitude,
        longitude,
        formattedAddress,
        accuracy: posAccuracy,
        altitude,
        speed,
        heading,
        timestamp: position.timestamp,
        isFallback: false,
      };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[LocationService] getCurrentLocation failed:', error);
      if (throwOnError) {
        throw error instanceof Error ? error : new Error(String(error));
      }
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
