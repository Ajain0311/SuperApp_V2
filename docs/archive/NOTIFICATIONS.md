# SuperApp React Native + Expo — Device Push & Local Notifications

## 1. Overview & Architecture

The mobile application integrates **Expo Notifications** (`expo-notifications` ~57.0.19) to provide device-level push notification reception, scheduled local alerts, foreground banner presentation, and response deep linking across both Android and iOS.

The notification system is encapsulated in `src/services/notificationService.ts` and managed through the global application lifecycle in `App.tsx`.

```
               ┌──────────────────────────────┐
               │   Expo Notification Service  │
               └──────────────┬───────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Push Token Mgmt  │ │ Local Scheduling │ │ Response Router  │
│ (EAS / Fallback) │ │ (Immediate / 5s) │ │ (Deep Linking)   │
└────────┬─────────┘ └──────────────────┘ └────────┬─────────┘
         │                                         │
         ▼                                         ▼
┌──────────────────┐                     ┌──────────────────┐
│ ASP.NET Core API │                     │ Root Navigation  │
│ /notifications/  │                     │ • FoodOrderTrack │
│ device-token     │                     │ • ActiveRide     │
│ (Graceful 404)   │                     │ • ListingDetail  │
└──────────────────┘                     │ • Notifications  │
                                         └──────────────────┘
```

---

## 2. Configuration & Permissions

### `app.json` Configuration
- **Android Permissions**: `POST_NOTIFICATIONS`
- **Expo Plugins**: `expo-notifications` with primary theme accent color (`#1976D2`) and app icon.

```json
{
  "expo": {
    "android": {
      "permissions": [
        "POST_NOTIFICATIONS"
      ]
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#1976D2"
        }
      ]
    ]
  }
}
```

### Permission Lifecycle
`NotificationService` exposes standardized permission methods:
- `getPermissionStatus(): Promise<NotificationPermissionStatus>`: Checks permission status (`'granted' | 'denied' | 'undetermined'`) without prompting the user.
- `requestPermission(): Promise<NotificationPermissionStatus>`: Prompts the user on iOS (alert, badge, sound) and Android (POST_NOTIFICATIONS).

---

## 3. Push Token Lifecycle & Backend Contract

### Push Token Retrieval
- Calls `Notifications.getExpoPushTokenAsync({ projectId })`.
- Extracts `projectId` safely from `Constants.expoConfig?.extra?.eas?.projectId` or `Constants.easConfig?.projectId`.
- If running in local development or a simulator where EAS projectId is not yet configured, catches the error cleanly and generates a development identifier (`ExponentPushToken[DEV-{Platform}-{Timestamp}]`), avoiding unhandled promises or crashes.

### Backend Token Registration Contract
- The ASP.NET Core `SuperApp.API` was audited for device push token persistence.
- `SuperApp.API/Controllers/NotificationsController.cs` provides endpoints for listing in-app notifications and marking notifications as read, while push delivery is handled via `INotificationService` / `MockNotificationService`.
- `NotificationService.registerDeviceTokenWithBackend(token)` dispatches `POST /api/notifications/device-token` with `{ token, platform, deviceType, registeredAt }`.
- If the endpoint returns `404 Not Found` (endpoint not yet provisioned on the current backend deployment), the client records an informational log and resumes without throwing an unhandled exception.

---

## 4. Foreground Presentation & Deep-Link Routing

### Foreground Presentation Handler
```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldSetAlert: true,
  }),
});
```

### Deep-Link Routing Table
When a user taps an incoming notification, `NotificationService.handleNotificationResponse(response, navigationRef)` routes to the target destination screen:

| Payload `module` | Target Screen | Parameters Passed |
| :--- | :--- | :--- |
| `FOOD_ORDER` / `FOOD` | `FoodOrderTracking` | `{ orderId, orderNumericId }` |
| `RIDE` / `RIDES` | `ActiveRide` | `{ rideId, rideNumericId }` |
| `MARKETPLACE` / `BAZAAR` | `ListingDetail` / `Bazaar` | `{ listingId }` |
| `GENERAL` / Other | `Notifications` | None |

---

## 5. Development Notification Tester

In `src/features/notifications/NotificationsScreen.tsx`, a development tester panel (`__DEV__`) is rendered above the notification feed:
1. **Token Display**: Shows active push token (or dev mock token).
2. **Food Alert Button**: Schedules immediate alert for order `#FO-1002` testing deep-linking to `FoodOrderTrackingScreen`.
3. **Ride Alert Button**: Schedules immediate alert for ride `#RD-5021` testing deep-linking to `ActiveRideScreen`.
4. **3s Delay Button**: Schedules a delayed notification with a 3-second time-interval trigger.

---

## 6. Teardown & Leak Prevention

Subscriptions returned by `addNotificationReceivedListener` and `addNotificationResponseReceivedListener` are cleaned up inside the `useEffect` return handler in `App.tsx`:
```ts
useEffect(() => {
  const removeReceived = notificationService.addNotificationReceivedListener(...);
  const removeResponse = notificationService.addNotificationResponseReceivedListener(...);
  return () => {
    removeReceived();
    removeResponse();
  };
}, []);
```
