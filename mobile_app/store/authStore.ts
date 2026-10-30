import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../lib/apiClient';
import type { User } from '../types/api';
import { useCartStore } from './cartStore';

/**
 * Web-safe storage shim — expo-secure-store is native-only.
 * On web (browser testing with `npm run web`) we fall back to
 * localStorage so the app loads without crashing. On device,
 * the real Keychain/Keystore-backed SecureStore is used.
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

interface AuthState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  // Actions
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (payload: {
    first_name: string;
    last_name?: string;
    email: string;
    phone?: string;
    age?: number;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  requestPhoneOtp: (identifier: string) => Promise<{
    ok: boolean;
    verification_id?: string;
    masked_identifier?: string;
    dev_code?: string;
    error?: string;
  }>;
  requestVerificationCode: (identifier: string, channel: 'phone' | 'email', purpose?: string) => Promise<{
    ok: boolean;
    verification_id?: string;
    masked_identifier?: string;
    dev_code?: string;
    error?: string;
  }>;
  verifyCode: (verification_id: string, code: string) => Promise<{
    ok: boolean;
    verified?: boolean;
    error?: string;
  }>;
  verifyPhoneOtp: (verification_id: string, code: string) => Promise<{
    ok: boolean;
    not_found?: boolean;
    phone?: string;
    email?: string;
    error?: string;
  }>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  isLoading: true,

  /** Called once at app startup — reads the stored token + user from SecureStore */
  hydrate: async () => {
    try {
      const token = await storage.getItem('auth_token');
      const userJson = await storage.getItem('auth_user');
      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ token, user, isLoggedIn: true });
        useCartStore.getState().hydrate(user.id);
      } else {
        useCartStore.getState().hydrate(null);
      }
    } catch (e) {
      // Corrupted storage — wipe and start fresh
      await storage.deleteItem('auth_token');
      await storage.deleteItem('auth_user');
      useCartStore.getState().hydrate(null);
    } finally {
      set({ isLoading: false });
    }
  },

  /** POST /api/v1/auth/login/ */
  login: async (identifier, password) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/login/', { identifier, password });
      const { ok, token, user, error } = res.data as { ok: boolean; token?: string; user?: User; error?: string };
      if (!ok || !token || !user) {
        set({ isLoading: false });
        return { ok: false, error: error ?? 'Login failed.' };
      }
      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));
      set({ token, user, isLoggedIn: true, isLoading: false });
      // Merge guest cart with saved user cart
      useCartStore.getState().onUserLogin(user.id);
      return { ok: true };
    } catch (err: any) {
      const error = err?.response?.data?.error ?? 'Network error. Check your connection.';
      set({ isLoading: false });
      return { ok: false, error };
    }
  },

  /** POST /api/v1/auth/signup/ */
  signup: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/signup/', payload);
      const { ok, token, user, error } = res.data as { ok: boolean; token?: string; user?: User; error?: string };
      if (!ok || !token || !user) {
        set({ isLoading: false });
        return { ok: false, error: error ?? 'Registration failed.' };
      }
      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));
      set({ token, user, isLoggedIn: true, isLoading: false });
      // Merge guest cart with saved user cart
      useCartStore.getState().onUserLogin(user.id);
      return { ok: true };
    } catch (err: any) {
      const error = err?.response?.data?.error ?? 'Network error. Check your connection.';
      set({ isLoading: false });
      return { ok: false, error };
    }
  },

  /** POST /api/v1/auth/phone/request/ */
  requestPhoneOtp: async (identifier) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/phone/request/', { identifier });
      set({ isLoading: false });
      return res.data;
    } catch (err: any) {
      const error = err?.response?.data?.error ?? 'Could not send verification code.';
      set({ isLoading: false });
      return { ok: false, error };
    }
  },

  /** Request OTP specifically for phone or email verification */
  requestVerificationCode: async (identifier, channel, purpose) => {
    try {
      const res = await apiClient.post('/auth/phone/request/', { identifier, channel, purpose });
      return res.data;
    } catch (err: any) {
      const error = err?.response?.data?.error ?? 'Could not send verification code.';
      return { ok: false, error };
    }
  },

  /** POST /api/v1/auth/verify-code/ */
  verifyCode: async (verification_id, code) => {
    try {
      const res = await apiClient.post('/auth/verify-code/', { verification_id, code });
      return res.data;
    } catch (err: any) {
      const error = err?.response?.data?.error ?? 'Invalid or expired verification code.';
      return { ok: false, error };
    }
  },

  /** POST /api/v1/auth/phone/verify/ */
  verifyPhoneOtp: async (verification_id, code) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post('/auth/phone/verify/', { verification_id, code });
      const { ok, token, user, error, not_found, phone, email } = res.data;
      if (!ok || !token || !user) {
        set({ isLoading: false });
        return { ok: false, not_found, phone, email, error: error ?? 'Verification failed.' };
      }
      await storage.setItem('auth_token', token);
      await storage.setItem('auth_user', JSON.stringify(user));
      set({ token, user, isLoggedIn: true, isLoading: false });
      // Merge guest cart with saved user cart
      useCartStore.getState().onUserLogin(user.id);
      return { ok: true };
    } catch (err: any) {
      const data = err?.response?.data;
      const error = data?.error ?? 'Verification failed. Please check the code.';
      set({ isLoading: false });
      return { ok: false, not_found: data?.not_found, phone: data?.phone, email: data?.email, error };
    }
  },

  /** POST /api/v1/auth/logout/ then wipe local state */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout/');
    } catch {
      // Even if the server request fails, wipe local state
    }
    useCartStore.getState().onUserLogout();
    await storage.deleteItem('auth_token');
    await storage.deleteItem('auth_user');
    set({ token: null, user: null, isLoggedIn: false });
  },
}));
