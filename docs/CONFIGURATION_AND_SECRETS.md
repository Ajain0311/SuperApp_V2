# SuperApp V2 — Configuration & Secrets Manual

This document details all configuration keys, environment variables, push notification settings, and security practices for running the SuperApp V2 platform in development, staging, and production.

---

## 1. Environment Variable Reference

### A. Push Notifications & Messaging

| Variable | Description | Default / Example | Notes |
| :--- | :--- | :--- | :--- |
| `NOTIFICATION_PROVIDER` | Active notification provider (`Expo`, `Firebase`, or `None`) | `Expo` | Defaults to Expo in both dev & prod for unified dispatch |
| `EXPO_ACCESS_TOKEN` | Bearer token for Expo Push Service | `token_xxxx` | Optional for standard rate limits; recommended for production |
| `FCM_SERVER_KEY` | Legacy Firebase Cloud Messaging key | `AAAA...` | Used if targeting direct FCM device tokens |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase v1 service account JSON string or path | `{"type": "service_account"...}` | Alternative FCM v1 authorization |

### B. SMS & Authentication Gateway

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SMS_API_URL` | BIGB SMS Gateway Base URL | `https://eapi.punjab.gov.in/smapi/sms` |
| `SMS_SERVER_KEY` | DLT Server Key authentication header | `YOUR_SECRET_KEY` |
| `SMS_TEMPLATE_ID` | DLT approved SMS template identifier | `1407177633307627182` |
| `OTP_PROVIDER` | Gateway provider (`BIGB`) | `BIGB` |
| `OTP_TEST_MODE` | Accept deterministic test OTP (`false` in production) | `false` |
| `TEST_OTP` | Fallback OTP code for local dev only | `123456` |

### C. Database & Security

| Variable | Description | Notes |
| :--- | :--- | :--- |
| `DATABASE_PROVIDER` | `Postgres` or `SqlServer` | Default: `Postgres` |
| `ConnectionStrings__DefaultConnection` | Full PostgreSQL connection string | Pooled Npgsql connection |
| `JWT_SECRET` | Secret key for signing JWT auth tokens | Minimum 32 characters |
| `JWT_ISSUER` | JWT token issuer | `SuperApp` |
| `JWT_AUDIENCE` | JWT token audience | `SuperApp` |

### D. Mobile Frontend (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_BASE_URL` | Base REST API URL | `http://localhost:80/api` or production URL |
| `EXPO_PUBLIC_SIGNALR_HUB_URL` | Base WebSocket SignalR URL | `http://localhost:80` or production URL |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox GL public access token | `pk.eyJ1...` |

---

## 2. Setting Up Real Android Push Notifications

### Prerequisites
1. **Physical Device or Development Build:**
   - Android SDK 53+ removed remote push notifications from standard Expo Go.
   - For real push verification, compile a development build:
     ```bash
     npx expo run:android
     # or using EAS Build
     eas build --profile development --platform android
     ```
2. **EAS Project ID:**
   - Configured in `app.json` under `extra.eas.projectId`.
   - The app automatically queries `Notifications.getExpoPushTokenAsync({ projectId })`.

### Token Registration Lifecycle
1. When the app launches and the user logs in:
   - `notificationService.getExpoPushToken()` requests notification permissions.
   - The device receives an `ExponentPushToken[...]`.
   - The token is submitted to `POST /api/notifications/device-token`.
   - The backend records/updates the active token in the `UserDeviceTokens` table.
2. When the user logs out:
   - `notificationService.unregisterDeviceToken()` calls `POST /api/notifications/unregister-device-token`.
   - The token is deactivated (`IsActive = false`) so the user receives no notifications after logging out.

### Testing Push Delivery
Use the diagnostics endpoint:
```http
GET /api/notifications/diagnostics
Authorization: Bearer <user_jwt_token>
```
Response:
```json
{
  "success": true,
  "data": {
    "provider": "Expo",
    "expoConfigured": true,
    "fcmConfigured": false,
    "activeTokensCount": 12,
    "activeCaptainsTokensCount": 4,
    "status": "Ready"
  }
}
```
