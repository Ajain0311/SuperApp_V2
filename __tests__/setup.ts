/// <reference types="jest" />

// Mock storage
const mockStorageMap = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorageMap.set(key, value);
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockStorageMap.get(key) ?? null);
  }),
  removeItem: jest.fn((key: string) => {
    mockStorageMap.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorageMap.clear();
    return Promise.resolve();
  }),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStorageMap.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => {
    return Promise.resolve(mockStorageMap.get(key) ?? null);
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockStorageMap.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (dict: any) => dict.ios || dict.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement('SafeAreaView', props, children),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: (cb: any) => cb(),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('Ionicons', props),
    MaterialIcons: (props: any) => React.createElement('MaterialIcons', props),
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }: any) => React.createElement('LinearGradient', props, children),
  };
});

jest.mock('expo-constants', () => ({



  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-eas-project-id',
        },
      },
    },
    appOwnership: 'standalone',
    executionEnvironment: 'standalone',
  },
  ExecutionEnvironment: {
    Bare: 'bare',
    Standalone: 'standalone',
    StoreClient: 'storeClient',
  },
  AppOwnership: {
    Expo: 'expo',
  },
}));

jest.mock('expo-notifications', () => {
  return {
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token-123]' }),
    scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id-123'),
    cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
    addNotificationReceivedListener: jest.fn().mockReturnValue({
      remove: jest.fn(),
    }),
    addNotificationResponseReceivedListener: jest.fn().mockReturnValue({
      remove: jest.fn(),
    }),
    SchedulableTriggerInputTypes: {
      TIME_INTERVAL: 'timeInterval',
    },
  };
});

jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = ({ children, ...props }: any) => React.createElement(View, props, children);
  const MockCamera = React.forwardRef((props: any, _ref: any) => React.createElement(View, props));
  const MockPointAnnotation = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    default: {
      setAccessToken: jest.fn(),
      StyleURL: { Street: 'mapbox://styles/mapbox/streets-v12' },
    },
    MapView: MockMapView,
    Camera: MockCamera,
    PointAnnotation: MockPointAnnotation,
  };
});

jest.mock('expo-location', () => {
  return {
    PermissionStatus: {
      GRANTED: 'granted',
      DENIED: 'denied',
      UNDETERMINED: 'undetermined',
    },
    Accuracy: {
      Lowest: 1,
      Low: 2,
      Balanced: 3,
      High: 4,
      Highest: 5,
      BestForNavigation: 6,
    },
    getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({
      coords: {
        latitude: 28.6304,
        longitude: 77.2177,
        accuracy: 5,
        altitude: 216,
        heading: 0,
        speed: 0,
      },
      timestamp: 1726500000000,
    }),
    getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
    watchPositionAsync: jest.fn().mockResolvedValue({
      remove: jest.fn(),
    }),
    reverseGeocodeAsync: jest.fn().mockResolvedValue([
      {
        name: 'Connaught Place',
        street: 'Connaught Circle',
        district: 'Central Delhi',
        city: 'New Delhi',
        region: 'Delhi',
      },
    ]),
  };
});

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file://mock-compressed.jpg',
    width: 1200,
    height: 800,
  }),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
}));

beforeEach(() => {
  mockStorageMap.clear();
  jest.clearAllMocks();
});
