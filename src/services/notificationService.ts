import type * as ExpoNotifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type NotificationTargetModule = 'FOOD_ORDER' | 'RIDE' | 'MARKETPLACE' | 'GENERAL';

export interface InAppNotification {
  title: string;
  message: string;
  module: string;
  timestamp: Date;
}

export interface PushNotificationPayload {
  module?: NotificationTargetModule | string;
  title?: string;
  body?: string;
  referenceId?: string;
  orderId?: string;
  orderNumericId?: number;
  rideId?: string;
  rideNumericId?: number;
  listingId?: string;
  [key: string]: any;
}

export interface ScheduleNotificationOptions {
  title: string;
  body: string;
  data?: PushNotificationPayload;
  delaySeconds?: number;
}

/**
 * Detect whether the app is executing inside the standard Expo Go client app.
 * In Expo SDK 53+, remote push notifications were permanently removed from Expo Go on Android.
 * Requiring or importing expo-notifications inside Expo Go on Android crashes on startup.
 */
export function isRunningInExpoGoClient(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require('expo');
    if (typeof expo?.isRunningInExpoGo === 'function') {
      return expo.isRunningInExpoGo();
    }
  } catch {
    // ignore
  }
  return (
    (Constants as any)?.appOwnership === 'expo' ||
    (ExecutionEnvironment && Constants?.executionEnvironment === ExecutionEnvironment.StoreClient)
  );
}

function resolveNotificationsModule(): typeof ExpoNotifications | null {
  // expo-notifications push token listeners are unsupported on web and spam console warnings.
  if (Platform.OS === 'web') {
    return null;
  }
  // Guard against fatal crash in Expo Go on Android (removed in SDK 53+)
  if (Platform.OS === 'android' && isRunningInExpoGoClient()) {
    console.warn(
      '[NotificationService] Expo Go on Android does not support remote push notifications in SDK 53+. ' +
      'Bypassing expo-notifications to prevent runtime crash. Use a development build (expo run:android) for full push notifications.'
    );
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch (error) {
    console.warn('[NotificationService] Native expo-notifications unavailable in current runtime:', error);
    return null;
  }
}

const Notifications = resolveNotificationsModule();

// Configure foreground presentation behavior for received notifications
if (Notifications?.setNotificationHandler) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldSetAlert: true,
      } as any),
    });
  } catch (e) {
    // In certain testing/headless environments, setNotificationHandler may be a no-op
  }
}

export class NotificationService {
  private inAppListeners: ((notification: InAppNotification) => void)[] = [];
  private cachedPushToken: string | null = null;

  /**
   * Check current push notification permission status without prompting
   */
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    if (!Notifications?.getPermissionsAsync) {
      return 'undetermined';
    }
    try {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted || settings.status === 'granted') {
        return 'granted';
      }
      if (settings.status === 'denied') {
        return 'denied';
      }
      return 'undetermined';
    } catch (error) {
      console.warn('[NotificationService] getPermissionStatus error:', error);
      return 'undetermined';
    }
  }

  /**
   * Configure Android notification channels for background and terminated delivery
   */
  async setupNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) {
      return;
    }
    try {
      await Notifications.setNotificationChannelAsync('ride-requests', {
        name: 'Ride Requests',
        importance: (Notifications.AndroidImportance?.MAX ?? 5) as any,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B00',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: (Notifications.AndroidImportance?.DEFAULT ?? 3) as any,
        enableVibrate: true,
        showBadge: true,
      });
    } catch (error) {
      console.warn('[NotificationService] setupNotificationChannels error:', error);
    }
  }

  /**
   * Request push notification permissions from user
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    await this.setupNotificationChannels();
    if (!Notifications?.requestPermissionsAsync) {
      return 'granted';
    }
    try {
      const settings = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      if (settings.granted || settings.status === 'granted') {
        return 'granted';
      }
      if (settings.status === 'denied') {
        return 'denied';
      }
      return 'undetermined';
    } catch (error) {
      console.warn('[NotificationService] requestPermission error:', error);
      return 'denied';
    }
  }

  /**
   * Fetch Expo Push Token for device.
   * Handles local dev environments where EAS projectId may not yet be configured.
   */
  async getExpoPushToken(): Promise<string | null> {
    if (this.cachedPushToken) {
      return this.cachedPushToken;
    }

    // Browser push via expo-notifications is incomplete; skip quietly on web.
    if (Platform.OS === 'web') {
      return null;
    }

    if (Platform.OS === 'android' && isRunningInExpoGoClient()) {
      console.warn(
        '[NotificationService] Remote push notifications are disabled in Expo Go on Android (SDK 53+). ' +
        'Please build a development client (npx expo run:android or EAS Build) for live remote push.'
      );
      return null;
    }

    if (!Notifications?.getExpoPushTokenAsync) {
      console.warn('[NotificationService] Expo Notifications native module is not available in this environment.');
      return null;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      if (tokenResponse?.data) {
        this.cachedPushToken = tokenResponse.data;
        return this.cachedPushToken;
      }
      return null;
    } catch (error) {
      console.warn(
        '[NotificationService] Could not retrieve remote Expo push token (requires real device or EAS development build):',
        error
      );
      return null;
    }
  }

  /**
   * Register push token with the ASP.NET Core SuperApp.API backend.
   * Gracefully handles cases where the endpoint is not yet configured on the backend.
   */
  async registerDeviceTokenWithBackend(token: string): Promise<boolean> {
    try {
      const trimmedToken = token?.trim();
      if (!trimmedToken || trimmedToken.startsWith('ExponentPushToken[DEV-')) {
        return false;
      }

      const payload = {
        token: trimmedToken,
        platform: Platform.OS,
        deviceType: Platform.select({ ios: 'iOS', android: 'Android', default: 'Other' }),
        registeredAt: new Date().toISOString(),
      };

      // Attempt to register with backend notifications/device endpoint
      await apiClient.post('/notifications/device-token', payload);
      return true;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.info(
          '[NotificationService] Device token registration endpoint not deployed on backend yet (/api/notifications/device-token).'
        );
      } else {
        console.warn('[NotificationService] Failed to register device token with backend:', error);
      }
      return false;
    }
  }

  /**
   * Unregister device push token with backend on logout
   */
  async unregisterDeviceToken(token?: string): Promise<boolean> {
    try {
      const targetToken = token || this.cachedPushToken;
      if (!targetToken) {
        return true;
      }
      await apiClient.post('/notifications/unregister-device-token', {
        token: targetToken,
      });
      if (this.cachedPushToken === targetToken) {
        this.cachedPushToken = null;
      }
      return true;
    } catch (error: any) {
      console.warn('[NotificationService] Failed to unregister device token on logout:', error);
      if (this.cachedPushToken === token) {
        this.cachedPushToken = null;
      }
      return false;
    }
  }

  /**
   * Schedule a local notification (immediate or delayed)
   */
  async scheduleLocalNotification(options: ScheduleNotificationOptions): Promise<string> {
    if (!Notifications?.scheduleNotificationAsync) {
      this.showAppAlert(options.title, options.body, options.data?.module || 'GENERAL');
      return `local-fallback-${Date.now()}`;
    }

    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.warn('[NotificationService] Notification permission not granted. Local alert skipped.');
        return '';
      }

      const trigger = options.delaySeconds && options.delaySeconds > 0
        ? {
            type: Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval',
            seconds: options.delaySeconds,
            repeats: false,
          }
        : null;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.data || {},
          sound: true,
        },
        trigger: trigger as any,
      });

      return id;
    } catch (error) {
      console.warn('[NotificationService] scheduleLocalNotification error:', error);
      return '';
    }
  }

  /**
   * Cancel all pending scheduled notifications
   */
  async cancelAllScheduledNotifications(): Promise<void> {
    if (!Notifications?.cancelAllScheduledNotificationsAsync) {
      return;
    }
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('[NotificationService] cancelAllScheduledNotifications error:', error);
    }
  }

  /**
   * Listen for incoming notifications while app is in foreground
   */
  addNotificationReceivedListener(
    listener: (notification: ExpoNotifications.Notification) => void
  ): () => void {
    if (!Notifications?.addNotificationReceivedListener) {
      return () => {};
    }
    const subscription = Notifications.addNotificationReceivedListener(listener);
    return () => {
      subscription.remove();
    };
  }

  /**
   * Listen for user tapping / responding to a notification
   */
  addNotificationResponseReceivedListener(
    listener: (response: ExpoNotifications.NotificationResponse) => void
  ): () => void {
    if (!Notifications?.addNotificationResponseReceivedListener) {
      return () => {};
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(listener);
    return () => {
      subscription.remove();
    };
  }

  /**
   * Deep-link / route user to the relevant screen based on the notification payload
   */
  handleNotificationResponse(
    response: ExpoNotifications.NotificationResponse,
    navigation: { navigate: (screen: string, params?: any) => void }
  ): void {
    if (!navigation || !response?.notification?.request?.content) return;

    const data = (response.notification.request.content.data || {}) as PushNotificationPayload;
    const module = (data.module || 'GENERAL').toUpperCase();

    switch (module) {
      case 'FOOD_ORDER':
      case 'FOOD':
        navigation.navigate('FoodOrderTracking', {
          orderId: data.orderId || data.referenceId || 'FO-1002',
          orderNumericId: data.orderNumericId,
        });
        break;

      case 'RIDE_REQUEST':
        // Captain incoming ride alert deep-link
        navigation.navigate('MainTabs', {
          screen: 'DriverHome',
          params: {
            focusRideId: data.rideNumericId || (data.referenceId ? parseInt(data.referenceId, 10) : undefined),
            rideNumber: data.rideId,
          },
        });
        break;

      case 'RIDE':
      case 'RIDES':
        navigation.navigate('ActiveRide', {
          rideId: data.rideId || data.referenceId || 'RD-5021',
          rideNumericId: data.rideNumericId,
        });
        break;


      case 'MARKETPLACE_CHAT':
      case 'MARKETPLACE_MESSAGE':
      case 'CHAT':
        if (data.referenceId || data.conversationId) {
          const convId = parseInt(String(data.conversationId || data.referenceId), 10);
          navigation.navigate('MarketplaceChat', {
            conversationId: !isNaN(convId) ? convId : undefined,
            listingId: String(data.listingId || '0'),
            sellerId: 0,
            sellerName: 'Chat',
            listingTitle: 'Marketplace Item',
            listingPrice: 0,
          });
        } else {
          navigation.navigate('MainTabs', { screen: 'Bazaar' });
        }
        break;

      case 'MARKETPLACE_OFFER':
      case 'MARKETPLACE':
      case 'BAZAAR':
        // Offer + listing notifications store listing id in referenceId / listingId
        if (data.listingId || data.referenceId) {
          navigation.navigate('ListingDetail', {
            listingId: String(data.listingId || data.referenceId),
          });
        } else {
          navigation.navigate('MainTabs', { screen: 'Bazaar' });
        }
        break;

      case 'GENERAL':
      default:
        navigation.navigate('Notifications');
        break;
    }
  }

  // --- Backwards-compatible in-app notification publisher/subscriber ---
  subscribe(listener: (notification: InAppNotification) => void): () => void {
    this.inAppListeners.push(listener);
    return () => {
      this.inAppListeners = this.inAppListeners.filter((l) => l !== listener);
    };
  }

  showAppAlert(title: string, message: string, module = 'GENERAL'): void {
    const item: InAppNotification = {
      title,
      message,
      module,
      timestamp: new Date(),
    };
    this.inAppListeners.forEach((l) => l(item));
  }
}

export const notificationService = new NotificationService();
