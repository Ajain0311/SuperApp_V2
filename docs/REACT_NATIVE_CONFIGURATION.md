# React Native + Expo Configuration Guide

This guide details how to configure environments, API endpoints, SignalR hubs, and build settings for the React Native + Expo project in `D:\FREELANCER\HTTP-EXPNAT-NET`.

---

## 1. Environment Variables & `.env`

The app uses Expo's public environment variable mechanism (`EXPO_PUBLIC_*`), which securely bundles public variables into the JavaScript bundle at build time without requiring extra native libraries.

### `.env.example` Template
A committed template is available at `.env.example`:

```env
# ==============================================================================
# SUPERAPP MOBILE - EXPO / REACT NATIVE ENVIRONMENT CONFIGURATION
# ==============================================================================

# Backend API Base URL
# Android Emulator: http://10.0.2.2:5000
# iOS Simulator / Web: http://localhost:5000
# Physical Device on LAN: http://<YOUR_LAN_IP>:5000 (e.g., http://192.168.1.100:5000)
# Production / Staging: https://api.superapp.example.com
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000

# SignalR Hub Endpoints (Appended to EXPO_PUBLIC_API_BASE_URL)
EXPO_PUBLIC_RIDE_HUB_URL=/hubs/ride
EXPO_PUBLIC_ORDER_HUB_URL=/hubs/order
EXPO_PUBLIC_CHAT_HUB_URL=/hubs/chat

# App Metadata & Overrides
EXPO_PUBLIC_APP_NAME="SuperApp"
EXPO_PUBLIC_APP_ENV="development"
EXPO_PUBLIC_ENABLE_DEBUG_LOGGING="true"
EXPO_PUBLIC_REQUEST_TIMEOUT_MS="15000"
```

---

## 2. Dynamic Platform Resolution

`src/config/environment.ts` inspects `Platform.OS` and automatically handles development loopback addressing:
- **Android Emulator**: `10.0.2.2` maps to the host workstation's `localhost`.
- **iOS Simulator & Web**: `localhost` or `127.0.0.1`.
- **Physical Devices**: Set `EXPO_PUBLIC_API_BASE_URL=http://<YOUR_LAN_IP>:5000` in `.env.local` to point to the host running ASP.NET Core (`dotnet run` in `D:\FREELANCER\HTTP-FLUTnNET\SuperApp.API`).

---

## 3. Connecting to the ASP.NET Core Backend

To connect the React Native app to the backend:

1. **Start the ASP.NET Core API** in the active backend directory:
   ```powershell
   cd D:\FREELANCER\HTTP-EXPNAT-NET\backend\SuperApp.API
   dotnet run --urls "http://localhost:5000"
   ```
   Confirm it starts listening on `http://localhost:5000`.

2. **Configure CORS in Backend (if not already enabled)**:
   The backend's `Program.cs` is already configured with CORS policy allowing origins during development.

3. **Start the Expo Development Server**:
   ```powershell
   cd D:\FREELANCER\HTTP-EXPNAT-NET
   npx expo start
   ```

4. **Run on Target**:
   - Press `a` for Android Emulator
   - Press `i` for iOS Simulator (macOS only)
   - Press `w` for Web Browser
   - Scan QR code with Expo Go app on an Android or iOS device on the same local network.

---

---

## 5. Device Push Notifications & Geolocation Configuration

### Device Push Notifications (`expo-notifications`)
- **Android Permissions**: Requires `android.permission.POST_NOTIFICATIONS` in `app.json`.
- **EAS Project ID**: For remote production push delivery via Expo Application Services, define your EAS Project ID in `app.json` (`expo.extra.eas.projectId`).
- **Local Fallback**: In local development without an EAS project, `NotificationService` generates a local token format `ExponentPushToken[DEV-{Platform}-{Timestamp}]` and allows instantaneous local notification scheduling and testing.
- **Backend Contract**: Device registration requests are dispatched to `POST /api/notifications/device-token`. If not provisioned on the current backend deployment, 404 responses are caught cleanly.

### Device Geolocation (`expo-location`)
- **Android Permissions**: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- **iOS Usage Description**: `NSLocationWhenInUseUsageDescription` in `app.json`.
- **Scope**: Foreground only. Background location tracking is intentionally excluded.
- **Fallback Coordinates**: If hardware GPS is toggled off or permissions are denied, `LocationService` defaults to Connaught Place, Central Delhi (`28.6304, 77.2177`) with a visible UI banner.
- **Driver GPS Isolation**: Driver location telemetry is managed exclusively via SignalR WebSocket events on `/hubs/ride` (`DriverLocationUpdated`), completely isolated from the customer's device GPS.

---

## 6. Git & Secrets Security Rules

- Never commit `.env` or `.env*.local` containing private keys or credentials.
- `.gitignore` explicitly filters:
  ```gitignore
  .env
  .env*.local
  .env.development
  .env.staging
  .env.production
  ```
- Use `git status` before committing to ensure no unintended files are staged.
