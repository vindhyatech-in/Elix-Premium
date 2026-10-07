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

function getBaseUrl(): string {
  if (Platform.OS === 'web') return `http://localhost:${PORT}/api/v1`;
  if (Platform.OS === 'android') return `http://10.0.2.2:${PORT}/api/v1`;
  return `http://localhost:${PORT}/api/v1`; // iOS simulator
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
