import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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

// Configure foreground presentation behavior for received notifications
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

export class NotificationService {
  private inAppListeners: ((notification: InAppNotification) => void)[] = [];
  private cachedPushToken: string | null = null;

  /**
   * Check current push notification permission status without prompting
   */
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
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
   * Request push notification permissions from user
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
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

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      console.warn('[NotificationService] Cannot retrieve push token: permission denied');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      this.cachedPushToken = tokenResponse.data;
      return this.cachedPushToken;
    } catch (error) {
      console.warn(
        '[NotificationService] Could not retrieve remote Expo push token (expected in local dev simulator):',
        error
      );
      // In local dev without EAS project configured, return a safe identifier
      const devToken = `ExponentPushToken[DEV-${Platform.OS}-${Date.now()}]`;
      this.cachedPushToken = devToken;
      return devToken;
    }
  }

  /**
   * Register push token with the ASP.NET Core SuperApp.API backend.
   * Gracefully handles cases where the endpoint is not yet configured on the backend.
   */
  async registerDeviceTokenWithBackend(token: string): Promise<boolean> {
    try {
      const payload = {
        token,
        platform: Platform.OS,
        deviceType: Platform.select({ ios: 'iOS', android: 'Android', default: 'Other' }),
        registeredAt: new Date().toISOString(),
      };

      // Attempt to register with backend notifications/device endpoint
      await apiClient.post('/notifications/device-token', payload);
      return true;
    } catch (error: any) {
      // If endpoint doesn't exist on current backend (404), log contract note without crashing
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
   * Schedule a local notification (immediate or delayed)
   */
  async scheduleLocalNotification(options: ScheduleNotificationOptions): Promise<string> {
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.warn('[NotificationService] Notification permission not granted. Local alert skipped.');
        return '';
      }

      const trigger: Notifications.NotificationTriggerInput = options.delaySeconds && options.delaySeconds > 0
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
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
        trigger,
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
    listener: (notification: Notifications.Notification) => void
  ): () => void {
    const subscription = Notifications.addNotificationReceivedListener(listener);
    return () => {
      subscription.remove();
    };
  }

  /**
   * Listen for user tapping / responding to a notification
   */
  addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(listener);
    return () => {
      subscription.remove();
    };
  }

  /**
   * Deep-link / route user to the relevant screen based on the notification payload
   */
  handleNotificationResponse(
    response: Notifications.NotificationResponse,
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

      case 'RIDE':
      case 'RIDES':
        navigation.navigate('ActiveRide', {
          rideId: data.rideId || data.referenceId || 'RD-5021',
          rideNumericId: data.rideNumericId,
        });
        break;

      case 'MARKETPLACE':
      case 'BAZAAR':
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
