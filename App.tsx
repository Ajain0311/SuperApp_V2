import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/colors';
import { notificationService } from './src/services/notificationService';
import { AppEnvironment } from './src/config/environment';
import { mapboxService } from './src/services/mapboxService';

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.primary,
  },
};

export default function App() {
  useEffect(() => {
    if ((Platform.OS === 'ios' || Platform.OS === 'android') && AppEnvironment.hasMapboxToken) {
      try {
        // Native Mapbox SDK — requires Expo Dev Client / prebuild (not Expo Go).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Mapbox = require('@rnmapbox/maps').default;
        Mapbox?.setAccessToken?.(mapboxService.getAccessToken());
      } catch (error) {
        console.warn('[Mapbox] Native maps unavailable in this runtime:', error);
      }
    }

    // Request push notification permissions and register token on app startup
    notificationService.getExpoPushToken().then((token) => {
      if (token) {
        notificationService.registerDeviceTokenWithBackend(token);
      }
    });

    // Handle foreground notifications
    const removeReceived = notificationService.addNotificationReceivedListener((notification) => {
      console.log('[Notification Received Foreground]', notification.request.content.title);
    });

    // Handle user interaction / response with notification
    const removeResponse = notificationService.addNotificationResponseReceivedListener((response) => {
      if (navigationRef.isReady()) {
        notificationService.handleNotificationResponse(response, navigationRef as any);
      }
    });

    return () => {
      removeReceived();
      removeResponse();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={CustomDarkTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
