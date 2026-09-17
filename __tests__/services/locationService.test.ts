import * as Location from 'expo-location';
import { LocationService, locationService } from '../../src/services/locationService';

describe('LocationService - Device GPS, Permissions & Geocoding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permissions', () => {
    it('returns "granted" when foreground permission is already granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.GRANTED,
      });

      const status = await locationService.checkPermission();
      expect(status).toBe('granted');
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('returns "denied" when foreground permission is denied', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.DENIED,
      });

      const status = await locationService.checkPermission();
      expect(status).toBe('denied');
    });

    it('returns "undetermined" when foreground permission is undetermined', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.UNDETERMINED,
      });

      const status = await locationService.checkPermission();
      expect(status).toBe('undetermined');
    });

    it('prompts user and returns granted when requesting foreground permissions', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.GRANTED,
      });

      const status = await locationService.requestPermission();
      expect(status).toBe('granted');
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Device Location Availability & Coordinates', () => {
    it('detects if hardware location services are enabled', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(true);
      const enabled = await locationService.isLocationServicesEnabled();
      expect(enabled).toBe(true);
    });

    it('returns fallback location when hardware GPS is disabled', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(false);
      const loc = await locationService.getCurrentLocation();
      expect(loc.latitude).toBe(LocationService.defaultLocation.latitude);
      expect(loc.longitude).toBe(LocationService.defaultLocation.longitude);
    });

    it('returns real GPS coordinates and reverse geocoded address when enabled & granted', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(true);
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.GRANTED,
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: 28.5562,
          longitude: 77.1000,
          accuracy: 8,
          altitude: 220,
          speed: 0,
          heading: 90,
        },
        timestamp: 1726501234567,
      });
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([
        {
          name: 'Terminal 3',
          street: 'Indira Gandhi International Airport Road',
          district: 'South West Delhi',
          region: 'Delhi',
        },
      ]);

      const loc = await locationService.getCurrentLocation();
      expect(loc.latitude).toBe(28.5562);
      expect(loc.longitude).toBe(77.1000);
      expect(loc.formattedAddress).toContain('Terminal 3');
      expect(loc.formattedAddress).toContain('Indira Gandhi International Airport Road');
    });

    it('falls back gracefully to default coordinates if GPS times out or throws', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(true);
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.GRANTED,
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(new Error('Hardware timeout'));

      const loc = await locationService.getCurrentLocation();
      expect(loc.latitude).toBe(LocationService.defaultLocation.latitude);
      expect(loc.longitude).toBe(LocationService.defaultLocation.longitude);
    });
  });

  describe('Watch Location & Teardown', () => {
    it('subscribes to location updates and returns a teardown unsubscribe callback', async () => {
      const mockRemove = jest.fn();
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.GRANTED,
      });
      (Location.watchPositionAsync as jest.Mock).mockResolvedValueOnce({
        remove: mockRemove,
      });

      const callback = jest.fn();
      const unsubscribe = await locationService.watchLocation(callback);

      expect(typeof unsubscribe).toBe('function');
      expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);

      // Verify teardown prevents memory leaks
      unsubscribe();
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('cleans up active watcher subscription via stopWatching()', async () => {
      const mockRemove = jest.fn();
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: Location.PermissionStatus.GRANTED,
      });
      (Location.watchPositionAsync as jest.Mock).mockResolvedValueOnce({
        remove: mockRemove,
      });

      await locationService.watchLocation(jest.fn());
      locationService.stopWatching();
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Haversine Distance & Urban Travel Duration', () => {
    it('accurately calculates distance between Connaught Place and IGI T3 with 1.25 urban road factor', () => {
      // Connaught Place: 28.6304, 77.2177 -> IGI T3: 28.5562, 77.1000
      const distance = locationService.calculateDistanceKm(28.6304, 77.2177, 28.5562, 77.1000);
      // Straight line ~14.1 km * 1.25 ~ 17.6 km
      expect(distance).toBeGreaterThan(15);
      expect(distance).toBeLessThan(20);
    });

    it('estimates duration based on 22 km/h average speed with 4-minute minimum threshold', () => {
      expect(locationService.estimateDurationMinutes(0.5)).toBe(4);
      expect(locationService.estimateDurationMinutes(16.5)).toBe(45);
    });
  });
});
