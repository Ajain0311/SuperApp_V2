import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { enableScreens } from 'react-native-screens';

import App from './App';

// On web, react-native-screens still passes deprecated props.pointerEvents.
// Disabling native screens there removes the console noise without affecting iOS/Android.
if (Platform.OS === 'web') {
  enableScreens(false);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
