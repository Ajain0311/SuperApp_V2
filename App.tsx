import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/theme/colors';
import { notificationService } from './src/services/notificationService';

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
