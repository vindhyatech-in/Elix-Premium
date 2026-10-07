import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/**
 * apiClient — Axios instance pointed at the Django REST backend.
 *
 * Base URL:   change DEV_BASE_URL to your LAN IP while developing on a
 *             physical device (Expo Go on Android can't reach localhost).
 *             For a production release, swap to https://yourdomain.in/api/v1.
 *
 * Auth:       Reads the token from SecureStore (key: 'auth_token') and
 *             attaches `Authorization: Token <key>` to every request.  The
 *             Django side reads this in api/auth.py::token_required.
 *
 * Error:      Non-2xx responses reject with the full AxiosError so callers can
 *             inspect .response?.data?.error for a user-facing message.
 */

// NOTE: Replace '10.0.2.2' (Android emulator host alias for localhost) with
// your machine's LAN IP when testing on a physical device.
const DEV_BASE_URL = 'http://10.0.2.2:8003/api/v1';

export const apiClient = axios.create({
  baseURL: DEV_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach bearer token from secure storage on every request
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Optional: surface network errors cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log in dev; in prod you'd send to a crash reporting service
    if (__DEV__) {
      console.warn('[API Error]', error.response?.status, error.response?.data ?? error.message);
    }
    return Promise.reject(error);
  }
);
