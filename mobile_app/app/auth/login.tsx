import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

const ROSE = '#C2185B';
const ROSE_DARK = '#880E4F';
const SURFACE = '#fff';
const TEXT = '#1C1C1E';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const ERROR = '#DC2626';
const BG = '#F8F5F7';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState('');

  const { login, isLoading } = useAuthStore();

  async function handleLogin() {
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your email or username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    const result = await login(identifier.trim(), password);
    if (result.ok) {
      router.replace('/(tabs)');
    } else {
      setError(result.error ?? 'Login failed. Please try again.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Wordmark */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>E</Text>
          </View>
          <Text style={styles.wordmark}>Elix</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>Welcome back</Text>
        <Text style={styles.subline}>Sign in to book your next beauty session</Text>

        {/* Card */}
        <View style={styles.card}>
          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email / Username field */}
          <Text style={styles.label}>Email or Username</Text>
          <View style={[styles.inputWrap, identifierFocused && styles.inputFocused]}>
            <Ionicons name="person-outline" size={18} color={identifierFocused ? ROSE : MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              placeholderTextColor="#B0B0B0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setIdentifierFocused(true)}
              onBlur={() => setIdentifierFocused(false)}
              returnKeyType="next"
              editable={!isLoading}
            />
          </View>

          {/* Password field */}
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={[styles.inputWrap, passwordFocused && styles.inputFocused]}>
            <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? ROSE : MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#B0B0B0"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={MUTED}
              />
            </TouchableOpacity>
          </View>

          {/* Sign-in button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          Don't have an account? Book a session on our{' '}
          <Text style={styles.footerLink}>website</Text> and we'll create one for you.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
    alignItems: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ROSE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  logoLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  wordmark: { fontSize: 28, fontWeight: '700', color: TEXT, letterSpacing: -0.5 },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 6,
    alignSelf: 'flex-start',
    width: '100%',
  },
  subline: { fontSize: 15, color: MUTED, marginBottom: 28, alignSelf: 'flex-start', width: '100%' },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { color: ERROR, fontSize: 13, flex: 1, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    height: 50,
  },
  inputFocused: { borderColor: ROSE, backgroundColor: '#FFF8FB' },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: TEXT, height: '100%' },
  loginBtn: {
    marginTop: 24,
    backgroundColor: ROSE,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  footerNote: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },
  footerLink: { color: ROSE, fontWeight: '600' },
});
