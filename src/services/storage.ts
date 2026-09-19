import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'superapp_auth_token';
const USER_DATA_KEY = 'superapp_user_data';
const ACTIVE_ROLE_KEY = 'superapp_active_role';

class StorageService {
  private isWeb = Platform.OS === 'web';

  async setToken(token: string): Promise<void> {
    try {
      if (this.isWeb) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      }
    } catch (e) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if (this.isWeb) {
        return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    } catch (e) {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    }
  }

  async clearToken(): Promise<void> {
    try {
      if (this.isWeb) {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      }
    } catch (e) {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }

  async setUserData(data: any): Promise<void> {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
  }

  async getUserData<T = any>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(USER_DATA_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setActiveRole(role: string): Promise<void> {
    await AsyncStorage.setItem(ACTIVE_ROLE_KEY, role);
  }

  async getActiveRole(): Promise<string | null> {
    return await AsyncStorage.getItem(ACTIVE_ROLE_KEY);
  }

  async clearActiveRole(): Promise<void> {
    await AsyncStorage.removeItem(ACTIVE_ROLE_KEY);
  }

  async clearAll(): Promise<void> {
    await this.clearToken();
    await AsyncStorage.removeItem(USER_DATA_KEY);
    await this.clearActiveRole();
  }
}

export const storage = new StorageService();
