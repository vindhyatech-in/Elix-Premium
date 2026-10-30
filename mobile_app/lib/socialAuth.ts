import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/api';

const PORT = 8003;

function getDjangoBase(): string {
  if (Platform.OS === 'android') return `http://10.0.2.2:${PORT}`;
  return `http://localhost:${PORT}`;
}

/**
 * Initiates OAuth sign in with Google or Apple.
 * Handles both Expo Web (full browser redirect cycle) and
 * Native iOS/Android (WebBrowser auth session + deep link).
 */
export async function initiateSocialSignIn(provider: 'google' | 'apple'): Promise<void> {
  try {
    const djangoBase = getDjangoBase();

    if (Platform.OS === 'web') {
      const origin =
        typeof window !== 'undefined' && window.location && window.location.origin
          ? window.location.origin
          : 'http://localhost:8081';
      const returnUrl = `${origin}/auth/callback`;
      const socialCallbackNext = `/api/v1/auth/social-callback/?return_url=${encodeURIComponent(returnUrl)}`;
      const authUrl = `${djangoBase}/accounts/${provider}/login/?process=login&next=${encodeURIComponent(
        socialCallbackNext
      )}`;

      window.location.href = authUrl;
      return;
    }

    // Native iOS / Android
    const returnUrl = 'mobileapp://auth/callback';
    const socialCallbackNext = `/api/v1/auth/social-callback/?return_url=${encodeURIComponent(returnUrl)}`;
    const authUrl = `${djangoBase}/accounts/${provider}/login/?process=login&next=${encodeURIComponent(
      socialCallbackNext
    )}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

    if (result.type === 'success' && result.url) {
      try {
        const urlObj = new URL(result.url);
        const token = urlObj.searchParams.get('token');
        const userStr = urlObj.searchParams.get('user');
        const error = urlObj.searchParams.get('error');

        if (error) {
          Alert.alert('Sign In Failed', error);
          return;
        }

        if (token && userStr) {
          const user = JSON.parse(decodeURIComponent(userStr)) as User;
          await useAuthStore.getState().setSession(token, user);
          router.replace('/(tabs)');
        }
      } catch (err: any) {
        Alert.alert('Sign In Error', 'Could not parse response from sign in provider.');
      }
    }
  } catch (err: any) {
    Alert.alert('Sign In Error', err?.message || 'Could not initiate social sign in.');
  }
}
