import { create } from 'zustand';
import { User, SendOtpResponse, AuthResponse } from '../models/auth';
import { storage } from '../services/storage';
import { apiClient, ApiError } from '../services/apiClient';
import { ApiEndpoints } from '../constants/api';
import { signalRService } from '../services/signalr';
import { useRoleStore } from './roleStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isFallbackSession: boolean;

  checkAuth: () => Promise<boolean>;
  sendOtp: (mobileNumber: string) => Promise<SendOtpResponse>;
  verifyOtp: (mobileNumber: string, otpCode: string, fullName?: string) => Promise<AuthResponse>;
  adminLogin: (mobileNumber: string, password: string, otpCode: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isFallbackSession: false,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await storage.getToken();
      if (!token) {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, isFallbackSession: false });
        return false;
      }

      const cachedUser = await storage.getUserData<User>();
      if (cachedUser) {
        set({ user: cachedUser, token, isAuthenticated: true, isLoading: false, isFallbackSession: token.startsWith('dev_') });
      }

      // Proactively fetch updated profile from backend if reachable
      try {
        const res = await apiClient.get<{ success: boolean; data: User }>(ApiEndpoints.auth.profile);
        if (res.success && res.data) {
          await storage.setUserData(res.data);
          set({ user: res.data, token, isAuthenticated: true, isLoading: false, isFallbackSession: false });
        }
      } catch {
        // If profile endpoint fails, keep cached session ONLY if cachedUser exists
        if (cachedUser) {
          set({ user: cachedUser, token, isAuthenticated: true, isLoading: false, isFallbackSession: token.startsWith('dev_') });
        } else {
          // Token is invalid/stale with no valid user; clear session
          await storage.clearAll();
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, isFallbackSession: false });
          return false;
        }
      }

      const currentUser = get().user;
      if (currentUser?.roles) {
        await useRoleStore.getState().syncWithUserRoles(currentUser.roles);
      }

      return true;
    } catch {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, isFallbackSession: false });
      return false;
    }
  },

  sendOtp: async (mobileNumber: string) => {
    set({ error: null });
    try {
      const response = await apiClient.post<SendOtpResponse>(ApiEndpoints.auth.sendOtp, {
        mobileNumber,
      });
      return response;
    } catch (e: any) {
      // In development fallback mode, permit seamless OTP entry
      const isDev = process.env.EXPO_PUBLIC_ENV !== 'production';
      if (isDev) {
        const offlineOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const isAdmin = mobileNumber === '9999999999' || mobileNumber.endsWith('9999');
        console.warn('[Auth] Backend OTP endpoint unreachable or error. Using development mock OTP.');
        return {
          success: true,
          message: isAdmin ? 'Admin detected (offline). Enter password.' : `Development Mock OTP: ${offlineOtp}`,
          isNewUser: !isAdmin,
          isAdmin,
          devOtp: isAdmin ? undefined : offlineOtp,
        };
      }
      const msg = e.message || 'Failed to send OTP';
      set({ error: msg });
      throw e;
    }
  },

  verifyOtp: async (mobileNumber: string, otpCode: string, fullName?: string) => {
    set({ error: null });
    try {
      const payload: any = { mobileNumber, otpCode };
      if (fullName && fullName.trim().length > 0) {
        payload.fullName = fullName.trim();
      }

      const response = await apiClient.post<AuthResponse>(ApiEndpoints.auth.verifyOtp, payload);

      if (response.success && response.token) {
        await storage.setToken(response.token);
        if (response.user) {
          await storage.setUserData(response.user);
        }
        set({
          user: response.user || null,
          token: response.token,
          isAuthenticated: true,
          error: null,
          isFallbackSession: false,
        });
        if (response.user?.roles) {
          await useRoleStore.getState().syncWithUserRoles(response.user.roles);
        }
      }

      return response;
    } catch (e: any) {
      // If backend verification fails in dev and code is 123456, allow development session
      const isDev = process.env.EXPO_PUBLIC_ENV !== 'production';
      if (isDev && otpCode === '123456') {
        console.warn('[Auth] Using development session fallback for dev OTP 123456.');
        const devToken = `dev_jwt_token_${Date.now()}`;
        const devUser: User = {
          id: 1,
          mobileNumber,
          fullName: fullName?.trim() || 'John Doe',
          roles: ['Customer'],
        };
        await storage.setToken(devToken);
        await storage.setUserData(devUser);
        set({
          user: devUser,
          token: devToken,
          isAuthenticated: true,
          error: null,
          isFallbackSession: true,
        });
        return {
          success: true,
          token: devToken,
          user: devUser,
          message: 'Development session established',
        };
      }

      const msg = e.message || 'Verification failed';
      set({ error: msg });
      throw e;
    }
  },

  adminLogin: async (mobileNumber: string, password: string, otpCode: string) => {
    set({ error: null });
    try {
      const response = await apiClient.post<AuthResponse>(ApiEndpoints.auth.adminLogin, {
        mobileNumber,
        password,
        otpCode,
      });

      if (response.success && response.token) {
        await storage.setToken(response.token);
        if (response.user) {
          await storage.setUserData(response.user);
        }
        set({
          user: response.user || null,
          token: response.token,
          isAuthenticated: true,
          error: null,
          isFallbackSession: false,
        });
        if (response.user?.roles) {
          await useRoleStore.getState().syncWithUserRoles(response.user.roles);
        }
      }

      return response;
    } catch (e: any) {
      const isDev = process.env.EXPO_PUBLIC_ENV !== 'production';
      if (isDev && password === 'Admin@123' && (mobileNumber === '9999999999' || mobileNumber.endsWith('9999'))) {
        const devToken = `dev_admin_token_${Date.now()}`;
        const adminUser: User = {
          id: 1,
          mobileNumber,
          fullName: 'Super Admin',
          roles: ['Admin', 'Customer'],
        };
        await storage.setToken(devToken);
        await storage.setUserData(adminUser);
        set({
          user: adminUser,
          token: devToken,
          isAuthenticated: true,
          error: null,
          isFallbackSession: true,
        });
        await useRoleStore.getState().syncWithUserRoles(adminUser.roles);
        return {
          success: true,
          token: devToken,
          user: adminUser,
          message: 'Development admin session established',
        };
      }

      const msg = e.message || 'Admin login failed';
      set({ error: msg });
      throw e;
    }
  },

  logout: async () => {
    try {
      await storage.clearAll();
    } catch {
      // Token must still be cleared in memory even if storage fails.
    }
    try {
      await signalRService.disconnectAll();
    } catch {
      // Ignore hub disconnect errors so logout always completes.
    }
    await useRoleStore.getState().resetRoles();
    set({ user: null, token: null, isAuthenticated: false, error: null, isFallbackSession: false });
  },

  updateUser: (updatedFields: Partial<User>) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...updatedFields };
      storage.setUserData(updated);
      set({ user: updated });
    }
  },

  clearError: () => set({ error: null }),
}));
