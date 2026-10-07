import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../lib/apiClient';
import type { User } from '../types/api';

/**
 * Web-safe storage shim — expo-secure-store is native-only.
 * On web (browser testing with `npm run web`) we fall back to
 * localStorage so the app loads without crashing.  On device,
 * the real Keychain/Keystore-backed SecureStore is used.
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return storage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return storage.setItem(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return storage.deleteItem(key);
  },
};

interface AuthState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  // Actions
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
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
        set({ token, user: JSON.parse(userJson), isLoggedIn: true });
      }
    } catch (e) {
      // Corrupted storage — wipe and start fresh
      await storage.deleteItem('auth_token');
      await storage.deleteItem('auth_user');
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
      return { ok: true };
    } catch (err: any) {
      const error = err?.response?.data?.error ?? 'Network error. Check your connection.';
      set({ isLoading: false });
      return { ok: false, error };
    }
  },

  /** POST /api/v1/auth/logout/ then wipe local state */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout/');
    } catch {
      // Even if the server request fails, wipe local state
    }
    await storage.deleteItem('auth_token');
    await storage.deleteItem('auth_user');
    set({ token: null, user: null, isLoggedIn: false });
  },
}));
