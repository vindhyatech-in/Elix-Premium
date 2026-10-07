import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../lib/apiClient';
import type { User } from '../types/api';

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
      const token = await SecureStore.getItemAsync('auth_token');
      const userJson = await SecureStore.getItemAsync('auth_user');
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson), isLoggedIn: true });
      }
    } catch (e) {
      // Corrupted storage — wipe and start fresh
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
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
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
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
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ token: null, user: null, isLoggedIn: false });
  },
}));
