import { Alert, Platform } from 'react-native';
import { useAlertStore } from '../store/alertStore';

/**
 * Polyfill for React Native's Alert.alert to use our custom AppAlert component
 * This overrides the default behavior globally.
 */
export const polyfillAlert = () => {
  const originalAlert = Alert.alert;

  Alert.alert = (title, message, buttons, options) => {
    // If running in a test environment, fallback to original to avoid breaking test suites
    if (process.env.NODE_ENV === 'test') {
      return originalAlert(title, message, buttons, options);
    }

    useAlertStore.getState().showAlert(
      title,
      message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buttons as any,
      options
    );
  };
};
