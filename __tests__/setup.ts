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

beforeEach(() => {
  mockStorageMap.clear();
  jest.clearAllMocks();
});
