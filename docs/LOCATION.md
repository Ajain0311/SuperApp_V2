# SuperApp React Native + Expo — Device Geolocation & Reverse Geocoding

## 1. Overview & Architecture

The mobile application integrates **Expo Location** (`expo-location` ~57.0.18) to provide device foreground GPS tracking, reverse geocoding of coordinates into human-readable street addresses, and continuous watching capabilities.

All location functionality is centralized in `src/services/locationService.ts` and integrated directly into customer booking flows such as `RideBookingScreen.tsx`.

```
                    ┌──────────────────────────────┐
                    │   Expo Location Service      │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
     │  Foreground GPS  │ │ Reverse Geocode  │ │ Haversine Metric │
     │  (Timeout Race)  │ │ (Street/District)│ │ (1.25x Urban Rt) │
     └────────┬─────────┘ └────────┬─────────┘ └──────────────────┘
              │                    │
              └──────────┬─────────┘
                         ▼
             ┌───────────────────────┐
             │ RideBookingScreen.tsx │
             │ Customer Pickup GPS   │
             └───────────────────────┘
```

> [!IMPORTANT]
> **Customer GPS vs. Driver GPS Distinction**:
> Customer device GPS coordinates are used **strictly** to identify pickup locations in `RideBookingScreen.tsx`.
> Driver vehicle telemetry is **strictly** received from the backend via SignalR WebSocket events (`RideTrackingHub` -> `DriverLocationUpdated`) on `ActiveRideScreen.tsx`.
> Customer GPS telemetry is never confused with or written over driver telemetry.

---

## 2. Permissions & Hardware Status

### `app.json` Configuration
- **Android Permissions**:
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_COARSE_LOCATION`
- **iOS InfoPlist**:
  - `NSLocationWhenInUseUsageDescription`: `"SuperApp uses your location to set pickup points for rides and recommend nearby restaurants and stores."`
- **Expo Plugins**:
  - `expo-location` with user-facing usage description.

### Permission Methods
- `checkPermission(): Promise<LocationPermissionStatus>`: Evaluates foreground permission without prompting (`'granted' | 'denied' | 'undetermined'`).
- `requestPermission(): Promise<LocationPermissionStatus>`: Prompts user for foreground location permission.
- `isLocationServicesEnabled(): Promise<boolean>`: Validates device-level location hardware toggles (`Location.hasServicesEnabledAsync()`).

---

## 3. Location Acquisition & Reverse Geocoding

### Protected GPS Request
`LocationService.getCurrentLocation()` executes a Promise race between hardware coordinate fetching and a configurable timeout (default 10,000ms):
- Automatically verifies hardware services and permissions first.
- Replaces raw latitude and longitude with human-readable street addresses using `reverseGeocode()`.
- If hardware services are disabled, permissions are denied, or the request times out, it gracefully falls back to default coordinates (`28.6304, 77.2177` Connaught Place, Central Delhi).

### Reverse Geocoding
`Location.reverseGeocodeAsync({ latitude, longitude })` formats:
`{name}, {street}, {district/subregion}, {region}` -> e.g. `"Connaught Place, Connaught Circle, Central Delhi, Delhi"`.

---

## 4. Ride Screen Integration

In `src/features/ride/RideBookingScreen.tsx`:
1. **GPS Online Badge**: Displays real-time GPS connectivity (`GPS Online` / `Locating...` / `GPS Denied`). Tapping the badge re-queries device GPS.
2. **"Use Current GPS" Button**: Positioned on the Pickup card. Fetches device GPS, updates `pickupCoords` and `pickupAddress`, and triggers a recalculation of route fares and ETAs via `POST /api/ride/estimate`.
3. **Ride Booking**: Passes real device coordinates (`pickupLatitude`, `pickupLongitude`) to `POST /api/ride/book`.

---

## 5. Haversine Distance & Duration Estimation

Matches the backend routing algorithm with an urban road layout factor:
```ts
calculateDistanceKm(startLat, startLng, endLat, endLng): number
// Haversine formula * 1.25 urban street layout factor

estimateDurationMinutes(distanceKm): number
// 22 km/h average urban speed, minimum 4 minutes threshold
```

---

## 6. Teardown & Leak Prevention

`LocationService.watchLocation(callback, options)` returns an unsubscribe function that immediately terminates the native hardware watcher:
```ts
const unsubscribe = await locationService.watchLocation((loc) => { ... });
// Inside useEffect cleanup:
unsubscribe();
```
Calling `stopWatching()` will also cleanly remove any active hardware subscription.
