import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { ElixColors } from '@/constants/theme';
import type { User } from '@/types/api';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token?: string; user?: string; error?: string }>();
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    async function handleCallback() {
      if (params.error) {
        alert(params.error);
        router.replace('/auth/login');
        return;
      }

      if (params.token && params.user) {
        try {
          const userObj = JSON.parse(decodeURIComponent(params.user)) as User;
          await setSession(params.token, userObj);
          router.replace('/(tabs)');
          return;
        } catch (e) {
          console.error('Failed to parse user session in callback', e);
        }
      }

      // If params not immediately ready, retry after a short moment or redirect to login
      const timer = setTimeout(() => {
        if (!useAuthStore.getState().isLoggedIn) {
          router.replace('/auth/login');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }

    handleCallback();
  }, [params.token, params.user, params.error]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={ElixColors.blue} />
      <Text style={styles.title}>Completing Sign In...</Text>
      <Text style={styles.subtitle}>Securing your Elix session</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ElixColors.surface1,
    padding: 24,
  },
  title: {
    marginTop: 18,
    fontSize: 17,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: ElixColors.inkMuted,
  },
});
