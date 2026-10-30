import React, { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const navigateAfterLogin = () => {
    if (redirect === 'booking' || redirect === 'cart') {
      router.replace({ pathname: '/(tabs)/services', params: { openBooking: '1' } });
    } else {
      router.replace('/(tabs)');
    }
  };

  // ── OTP State (First Priority) ─────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [maskedTarget, setMaskedTarget] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [devCode, setDevCode] = useState<string | null>(null);

  // ── Password State (Secondary Method) ──────────────────────────────────────
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Focus & UI error states
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { login, requestPhoneOtp, verifyPhoneOtp, isLoading } = useAuthStore();

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: any;
    if (otpStep === 'verify' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpStep, countdown]);

  // ── OTP HANDLERS ───────────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError('');
    const target = phoneOrEmail.trim();
    if (!target) {
      setError('Please enter your 10-digit phone number or email address.');
      return;
    }

    const res = await requestPhoneOtp(target);
    if (res.ok && res.verification_id) {
      setVerificationId(res.verification_id);
      setMaskedTarget(res.masked_identifier || target);
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setOtpCode(res.dev_code); // Pre-fill in dev mode for instant friction-free testing
      }
      setOtpStep('verify');
      setCountdown(60);
    } else {
      setError(res.error || 'Failed to send verification code. Please try again.');
    }
  }

  async function handleVerifyOtp() {
    setError('');
    const code = otpCode.trim();
    if (!code || code.length < 4) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    const res = await verifyPhoneOtp(verificationId, code);
    if (res.ok) {
      navigateAfterLogin();
    } else if (res.not_found) {
      Alert.alert(
        'Account Not Found',
        'No existing account was found for this phone/email. Would you like to create a new account?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Up',
            onPress: () => router.push({ pathname: '/auth/signup', params: { redirect } }),
          },
        ]
      );
    } else {
      setError(res.error || 'Incorrect code. Please try again.');
    }
  }

  async function handleResendOtp() {
    if (countdown > 0) return;
    setError('');
    const res = await requestPhoneOtp(phoneOrEmail.trim());
    if (res.ok && res.verification_id) {
      setVerificationId(res.verification_id);
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setOtpCode(res.dev_code);
      }
      setCountdown(60);
      Alert.alert('Code Sent', 'A new verification code has been dispatched.');
    } else {
      setError(res.error || 'Failed to resend code.');
    }
  }

  // ── PASSWORD HANDLER ───────────────────────────────────────────────────────
  async function handlePasswordLogin() {
    setError('');
    if (!identifier.trim()) {
      setError('Please enter your username or email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    const result = await login(identifier.trim(), password);
    if (result.ok) {
      navigateAfterLogin();
    } else {
      setError(result.error ?? 'Incorrect email/username or password.');
    }
  }

  function handleThirdPartyNotice(provider: string) {
    Alert.alert(
      provider,
      `${provider} authentication will launch your browser session. For quick testing, use the OTP login above.`
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Logo Header */}
        <TouchableOpacity
          style={styles.logoRow}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.brandLogo}>
            Elix<Text style={styles.brandLogoAccent}>.</Text>
          </Text>
        </TouchableOpacity>

        {/* Auth Card */}
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              If you have not created an account yet, then please{' '}
              <Text
                style={styles.inlineLink}
                onPress={() => router.push('/auth/signup')}
              >
                sign up
              </Text>{' '}
              first.
            </Text>
          </View>

          {/* Alert error box */}
          {error ? (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle-outline" size={18} color={ElixColors.ink} />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── 1. FIRST PRIORITY: SIGN IN WITH OTP (WHATSAPP / SMS) ─────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <View style={styles.otpSection}>
            <View style={styles.priorityBadgeRow}>
              <View style={styles.priorityBadge}>
                <Ionicons name="flash" size={12} color={ElixColors.blue} />
                <Text style={styles.priorityBadgeText}>RECOMMENDED • FASTEST</Text>
              </View>
            </View>

            {otpStep === 'request' ? (
              // Step 1: Request OTP
              <View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PHONE NUMBER OR EMAIL (OTP):</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'phoneOrEmail' && styles.inputFocused,
                    ]}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={18}
                      color={ElixColors.inkMuted}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.input}
                      value={phoneOrEmail}
                      onChangeText={setPhoneOrEmail}
                      placeholder="9876543210 or name@example.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedField('phoneOrEmail')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="done"
                      onSubmitEditing={handleSendOtp}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                  onPress={handleSendOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#16120F" size="small" />
                  ) : (
                    <View style={styles.btnContentRow}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#16120F" />
                      <Text style={styles.submitBtnText}>Send Verification Code</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Step 2: Verify OTP
              <View>
                <View style={styles.sentNoticeBox}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                  <Text style={styles.sentNoticeText}>
                    Code sent to <Text style={{ fontWeight: '700' }}>{maskedTarget}</Text>
                  </Text>
                </View>

                {devCode ? (
                  <View style={styles.devBanner}>
                    <Text style={styles.devBannerText}>
                      Demo/Dev Code: <Text style={{ fontWeight: '800' }}>{devCode}</Text>
                    </Text>
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>ENTER 6-DIGIT CODE:</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'otpCode' && styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      placeholder="••••••"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={6}
                      onFocus={() => setFocusedField('otpCode')}
                      onBlur={() => setFocusedField(null)}
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyOtp}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#16120F" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Verify & Sign In</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.otpActionRow}>
                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={countdown > 0}
                  >
                    <Text
                      style={[
                        styles.resendText,
                        countdown > 0 && styles.resendTextDisabled,
                      ]}
                    >
                      {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setOtpStep('request');
                      setOtpCode('');
                      setError('');
                    }}
                  >
                    <Text style={styles.changeTargetText}>Change number</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── 2. SECONDARY: SIGN IN WITH PASSWORD ─────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN WITH PASSWORD</Text>
            <View style={styles.dividerLine} />
          </View>

          {!showPasswordForm ? (
            <TouchableOpacity
              style={styles.togglePasswordBtn}
              onPress={() => setShowPasswordForm(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="key-outline" size={18} color={ElixColors.ink} />
              <Text style={styles.togglePasswordText}>Use Username & Password</Text>
              <Ionicons name="chevron-down" size={16} color={ElixColors.inkMuted} />
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordForm}>
              {/* USERNAME OR EMAIL */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>USERNAME OR EMAIL:</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'identifier' && styles.inputFocused,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="Username or email address"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('identifier')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* PASSWORD WITH SHOW/HIDE TOGGLE */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>PASSWORD:</Text>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        'Forgot Password',
                        'You can log in instantly above using WhatsApp / SMS OTP without entering your password.'
                      )
                    }
                    hitSlop={6}
                  >
                    <Text style={styles.forgotLink}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'password' && styles.inputFocused,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="done"
                    onSubmitEditing={handlePasswordLogin}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={10}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={ElixColors.inkMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* REMEMBER ME */}
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxActive,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.rememberText}>Remember Me</Text>
              </TouchableOpacity>

              {/* SUBMIT BUTTON */}
              <TouchableOpacity
                style={[styles.secondarySubmitBtn, isLoading && styles.submitBtnDisabled]}
                onPress={handlePasswordLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={ElixColors.ink} size="small" />
                ) : (
                  <Text style={styles.secondarySubmitBtnText}>Sign In with Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── 3. SOCIAL LOGINS (GOOGLE / APPLE) ───────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialList}>
            {/* GOOGLE */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleThirdPartyNotice('Google')}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* APPLE */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleThirdPartyNotice('Apple')}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={19} color={ElixColors.ink} />
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ElixColors.surface1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoRow: {
    marginBottom: 24,
    alignItems: 'center',
  },
  brandLogo: {
    fontSize: 32,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    letterSpacing: -0.5,
  },
  brandLogoAccent: {
    color: ElixColors.blue,
  },

  // Auth Card
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.xl,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    lineHeight: 20,
  },
  inlineLink: {
    color: ElixColors.blue,
    fontWeight: ElixTypography.weights.bold,
    textDecorationLine: 'underline',
  },

  // Alert
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface3,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: ElixRadii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: ElixColors.ink,
    fontWeight: ElixTypography.weights.medium,
  },

  // OTP Priority Section
  otpSection: {
    marginBottom: 4,
  },
  priorityBadgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ElixRadii.full,
    gap: 4,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  sentNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: ElixRadii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    gap: 8,
  },
  sentNoticeText: {
    fontSize: 13,
    color: '#065F46',
  },
  devBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: ElixRadii.md,
    padding: 8,
    marginBottom: 12,
  },
  devBannerText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  otpInput: {
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    fontWeight: ElixTypography.weights.bold,
  },
  otpActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  resendText: {
    fontSize: 13,
    color: ElixColors.blue,
    fontWeight: ElixTypography.weights.bold,
  },
  resendTextDisabled: {
    color: ElixColors.inkMuted,
    fontWeight: ElixTypography.weights.medium,
  },
  changeTargetText: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    textDecorationLine: 'underline',
  },

  // Form Fields
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotLink: {
    fontSize: 12,
    color: ElixColors.blue,
    fontWeight: ElixTypography.weights.semiBold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1.5,
    borderColor: ElixColors.borderHairlineMedium,
    borderRadius: ElixRadii.md,
    backgroundColor: ElixColors.surface1,
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: ElixColors.blue,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: ElixColors.ink,
    height: '100%',
  },
  toggleBtn: {
    padding: 6,
  },

  // Submit Buttons
  submitBtn: {
    height: 52,
    backgroundColor: ElixColors.blue,
    borderRadius: ElixRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ElixColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: ElixColors.white,
    fontSize: 15,
    fontWeight: ElixTypography.weights.bold,
    letterSpacing: 0.2,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Secondary Password Form
  togglePasswordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    borderRadius: ElixRadii.pill,
    backgroundColor: ElixColors.surface1,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    paddingHorizontal: 18,
  },
  togglePasswordText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: ElixTypography.weights.semiBold,
    color: ElixColors.ink,
  },
  passwordForm: {
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: ElixColors.borderHairlineMedium,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  rememberText: {
    fontSize: 13,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.inkSoft,
  },
  secondarySubmitBtn: {
    height: 50,
    borderRadius: ElixRadii.pill,
    backgroundColor: ElixColors.surface1,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondarySubmitBtnText: {
    fontSize: 14,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },

  // Divider
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ElixColors.borderHairline,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
  },

  // Social
  socialList: {
    gap: 10,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: ElixRadii.pill,
    backgroundColor: ElixColors.surface1,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    paddingHorizontal: 16,
    gap: 10,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: ElixTypography.weights.semiBold,
    color: ElixColors.ink,
  },
});
