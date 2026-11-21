import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * apiClient — Axios instance pointed at the Django REST backend.
 *
 * URL resolution (auto-detected by platform):
 *   web (browser)      → http://localhost:8003/api/v1   (Django is running on same machine)
 *   Android emulator   → http://10.0.2.2:8003/api/v1   (emulator host alias for localhost)
 *   iOS simulator      → http://localhost:8003/api/v1
 *   Physical device    → set DEVICE_LAN_IP below to your laptop's LAN IP (e.g. 192.168.1.10)
 */

const PORT = 8003;
const DEVICE_LAN_IP = '192.168.1.100'; // change this for physical Expo Go testing

const LIVE_HOST = 'https://elix.vindhyatech.in';

export function getBaseHost(): string {
  if (process.env.EXPO_PUBLIC_HOST) {
    return process.env.EXPO_PUBLIC_HOST.replace(/\/+$/, '');
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  return LIVE_HOST;
}

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const host = getBaseHost();
  return `${host}${path.startsWith('/') ? '' : '/'}${path}`;
}

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return `${getBaseHost()}/api/v1`;
}

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach bearer token on every request
apiClient.interceptors.request.use(async (config) => {
  let token: string | null = null;
  try {
    if (Platform.OS === 'web') {
      token = localStorage.getItem('auth_token');
    } else {
      token = await SecureStore.getItemAsync('auth_token');
    }
  } catch {}
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__) {
      console.warn('[API Error]', error.response?.status, error.response?.data ?? error.message);
    }
    return Promise.reject(error);
  }
);
