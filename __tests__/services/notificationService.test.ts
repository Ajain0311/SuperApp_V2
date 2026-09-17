import * as Notifications from 'expo-notifications';
import { notificationService } from '../../src/services/notificationService';
import { apiClient } from '../../src/services/apiClient';

describe('NotificationService - Push Permissions, Scheduling & Deep-Link Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permissions', () => {
    it('returns "granted" when push permissions are already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
        granted: true,
      });

      const status = await notificationService.getPermissionStatus();
      expect(status).toBe('granted');
    });

    it('returns "denied" when push permissions are rejected', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
      });

      const status = await notificationService.getPermissionStatus();
      expect(status).toBe('denied');
    });

    it('requests permissions with iOS alert, badge, and sound options', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
        granted: true,
      });

      const status = await notificationService.requestPermission();
      expect(status).toBe('granted');
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    });
  });

  describe('Push Token Retrieval & Backend Registration', () => {
    it('fetches Expo push token using EAS project ID configuration', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
        granted: true,
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'ExponentPushToken[mock-device-token-xyz]',
      });

      const token = await notificationService.getExpoPushToken();
      expect(token).toBe('ExponentPushToken[mock-device-token-xyz]');
    });

    it('gracefully handles missing backend registration endpoint (404) without throwing', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce({
        status: 404,
        message: 'Not Found',
      });

      const success = await notificationService.registerDeviceTokenWithBackend('ExponentPushToken[test]');
      expect(success).toBe(false);
    });

    it('registers token successfully when backend endpoint responds 200 OK', async () => {
      jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { success: true, message: 'Device token registered' },
      } as any);

      const success = await notificationService.registerDeviceTokenWithBackend('ExponentPushToken[test]');
      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/notifications/device-token',
        expect.objectContaining({
          token: 'ExponentPushToken[test]',
          platform: 'ios',
        })
      );
    });
  });

  describe('Local Notification Scheduling', () => {
    it('schedules immediate notification when delaySeconds is not provided', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
        granted: true,
      });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('notif-id-123');

      const id = await notificationService.scheduleLocalNotification({
        title: 'Order Status',
        body: 'Your food is preparing',
        data: { module: 'FOOD_ORDER', orderId: 'FO-1002' },
      });

      expect(id).toBe('notif-id-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Order Status',
          body: 'Your food is preparing',
          data: { module: 'FOOD_ORDER', orderId: 'FO-1002' },
          sound: true,
        },
        trigger: null,
      });
    });

    it('schedules delayed notification with time interval trigger', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
        granted: true,
      });

      await notificationService.scheduleLocalNotification({
        title: 'Ride Update',
        body: 'Driver approaching',
        data: { module: 'RIDE', rideId: 'RD-5021' },
        delaySeconds: 5,
      });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: {
            type: 'timeInterval',
            seconds: 5,
            repeats: false,
          },
        })
      );
    });

    it('cancels all scheduled notifications', async () => {
      await notificationService.cancelAllScheduledNotifications();
      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Listeners & Teardown Subscriptions', () => {
    it('registers foreground listener and tears down cleanly without memory leaks', () => {
      const mockRemove = jest.fn();
      (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValueOnce({
        remove: mockRemove,
      });

      const unsubscribe = notificationService.addNotificationReceivedListener(jest.fn());
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('registers response listener and tears down cleanly without memory leaks', () => {
      const mockRemove = jest.fn();
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValueOnce({
        remove: mockRemove,
      });

      const unsubscribe = notificationService.addNotificationResponseReceivedListener(jest.fn());
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(mockRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Deep-Link / Response Routing', () => {
    const mockNavigation = {
      navigate: jest.fn(),
    };

    it('routes FOOD_ORDER notifications to FoodOrderTracking screen with order params', () => {
      const response: any = {
        notification: {
          request: {
            content: {
              data: {
                module: 'FOOD_ORDER',
                orderId: 'FO-999',
                orderNumericId: 999,
              },
            },
          },
        },
      };

      notificationService.handleNotificationResponse(response, mockNavigation);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('FoodOrderTracking', {
        orderId: 'FO-999',
        orderNumericId: 999,
      });
    });

    it('routes RIDE notifications to ActiveRide screen with ride params', () => {
      const response: any = {
        notification: {
          request: {
            content: {
              data: {
                module: 'RIDE',
                rideId: 'RD-777',
                rideNumericId: 777,
              },
            },
          },
        },
      };

      notificationService.handleNotificationResponse(response, mockNavigation);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ActiveRide', {
        rideId: 'RD-777',
        rideNumericId: 777,
      });
    });

    it('routes MARKETPLACE notifications to ListingDetail screen', () => {
      const response: any = {
        notification: {
          request: {
            content: {
              data: {
                module: 'MARKETPLACE',
                listingId: '42',
              },
            },
          },
        },
      };

      notificationService.handleNotificationResponse(response, mockNavigation);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ListingDetail', {
        listingId: '42',
      });
    });

    it('routes GENERAL notifications to Notifications screen', () => {
      const response: any = {
        notification: {
          request: {
            content: {
              data: {
                module: 'GENERAL',
              },
            },
          },
        },
      };

      notificationService.handleNotificationResponse(response, mockNavigation);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Notifications');
    });
  });

  describe('In-App Alert Publisher / Subscriber', () => {
    it('notifies registered in-app listeners and removes subscription on teardown', () => {
      const listener = jest.fn();
      const unsubscribe = notificationService.subscribe(listener);

      notificationService.showAppAlert('Promo', '50% off today', 'FOOD');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Promo',
          message: '50% off today',
          module: 'FOOD',
        })
      );

      unsubscribe();
      notificationService.showAppAlert('Promo 2', 'Another promo', 'RIDE');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
