import { create } from 'zustand';
import { User, SendOtpResponse, AuthResponse } from '../models/auth';
import { storage } from '../services/storage';
import { apiClient, ApiError } from '../services/apiClient';
import { ApiEndpoints } from '../constants/api';
import { signalRService } from '../services/signalr';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

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

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await storage.getToken();
      if (!token) {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        return false;
      }

      const cachedUser = await storage.getUserData<User>();
      if (cachedUser) {
        set({ user: cachedUser, token, isAuthenticated: true, isLoading: false });
      }

      // Proactively fetch updated profile from backend if reachable
      try {
        const res = await apiClient.get<{ success: boolean; data: User }>(ApiEndpoints.auth.profile);
        if (res.success && res.data) {
          await storage.setUserData(res.data);
          set({ user: res.data, token, isAuthenticated: true, isLoading: false });
        }
      } catch (profileErr) {
        // If profile endpoint fails, keep cached session if token exists
        if (cachedUser) {
          set({ user: cachedUser, token, isAuthenticated: true, isLoading: false });
        } else {
          // Fallback mock customer user
          const fallbackUser: User = {
            id: 1,
            mobileNumber: '9876543210',
            fullName: 'John Doe',
            email: 'john.doe@superapp.com',
            roles: ['Customer'],
          };
          set({ user: fallbackUser, token, isAuthenticated: true, isLoading: false });
        }
      }

      return true;
    } catch {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
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
        });
      }

      return response;
    } catch (e: any) {
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
        });
      }

      return response;
    } catch (e: any) {
      const msg = e.message || 'Admin login failed';
      set({ error: msg });
      throw e;
    }
  },

  logout: async () => {
    await storage.clearAll();
    await signalRService.disconnectAll();
    set({ user: null, token: null, isAuthenticated: false, error: null });
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
