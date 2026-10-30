import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { initiateSocialSignIn } from '@/lib/socialAuth';
import { BottomNav } from '@/components/ui/BottomNav';

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  const navigateAfterLogin = () => {
    if (redirect === 'booking' || redirect === 'cart') {
      router.replace({ pathname: '/(tabs)/services', params: { openBooking: '1' } });
    } else {
      router.replace('/(tabs)');
    }
  };

  // ── Tab Switcher State ─────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');

  // ── OTP State (First Priority) ─────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [maskedTarget, setMaskedTarget] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);

  // ── Password State (Secondary Method) ──────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Focus & error states
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { login, requestPhoneOtp, verifyPhoneOtp, isLoading } = useAuthStore();

  // Resend cooldown timer
  useEffect(() => {
    let timer: any;
    if (otpStep === 'verify' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpStep, countdown]);

  // ── 1. SEND OTP ────────────────────────────────────────────────────────────
  async function handleSendOtp() {
    setError('');
    const target = phoneOrEmail.trim();
    if (!target) {
      setError('Please enter your phone number or email address.');
      return;
    }

    const res = await requestPhoneOtp(target);
    if (res.ok && res.verification_id) {
      setVerificationId(res.verification_id);
      setMaskedTarget(res.masked_identifier || target);
      setOtpCode('');
      setOtpStep('verify');
      setCountdown(60);
    } else {
      setError(res.error || 'Failed to send verification code. Please try again.');
    }
  }

  // ── 2. VERIFY OTP ──────────────────────────────────────────────────────────
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
        'No existing account was found for this phone or email. Please sign up first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Up',
            onPress: () => router.push({ pathname: '/auth/signup', params: { redirect } }),
          },
        ]
      );
    } else {
      setError(res.error || 'Incorrect or expired verification code.');
    }
  }

  // ── 3. RESEND OTP ──────────────────────────────────────────────────────────
  async function handleResendOtp() {
    if (countdown > 0) return;
    setError('');
    const res = await requestPhoneOtp(phoneOrEmail.trim());
    if (res.ok && res.verification_id) {
      setVerificationId(res.verification_id);
      setOtpCode('');
      setCountdown(60);
      Alert.alert('Code Sent', 'A new verification code has been dispatched to your WhatsApp and Email.');
    } else {
      setError(res.error || 'Failed to resend code.');
    }
  }

  // ── 4. PASSWORD LOGIN ──────────────────────────────────────────────────────
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

  async function handleGoogleLogin() {
    await initiateSocialSignIn('google');
  }

  async function handleAppleLogin() {
    await initiateSocialSignIn('apple');
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
        {/* Brand Logo Header with luxury badge */}
        <TouchableOpacity
          style={styles.logoWrap}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.brandLogo}>
            <Text style={styles.brandLogoAccent}>E</Text>lix
          </Text>
          <Text style={styles.brandTagline}>LUXURY SALON & SPA AT HOME</Text>
        </TouchableOpacity>

        {/* Auth Card */}
        <View style={styles.card}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {otpStep === 'verify' ? 'Verification Code' : 'Welcome Back'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {otpStep === 'verify' ? (
                <>
                  We sent a 6-digit code to{' '}
                  <Text style={styles.boldText}>{maskedTarget}</Text>
                </>
              ) : (
                'Sign in to book your beauty session'
              )}
            </Text>
          </View>

          {/* Alert error box */}
          {error ? (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ── SEGMENTED TAB SWITCHER (Quick OTP vs Password) ───────────── */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {otpStep === 'request' && (
            <View style={styles.segmentContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, authMode === 'otp' && styles.segmentBtnActive]}
                onPress={() => {
                  setAuthMode('otp');
                  setError('');
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="flash"
                  size={14}
                  color={authMode === 'otp' ? ElixColors.blue : ElixColors.inkMuted}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    authMode === 'otp' && styles.segmentTextActive,
                  ]}
                >
                  Quick OTP
                </Text>
                <View
                  style={[
                    styles.recomBadge,
                    authMode === 'otp' && styles.recomBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.recomBadgeText,
                      authMode === 'otp' && styles.recomBadgeTextActive,
                    ]}
                  >
                    Recommended
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  authMode === 'password' && styles.segmentBtnActive,
                ]}
                onPress={() => {
                  setAuthMode('password');
                  setError('');
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="key-outline"
                  size={14}
                  color={authMode === 'password' ? ElixColors.blue : ElixColors.inkMuted}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    authMode === 'password' && styles.segmentTextActive,
                  ]}
                >
                  Password
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ── TAB 1: OTP FLOW ───────────────────────────────────────────── */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {authMode === 'otp' && (
            <>
              {otpStep === 'request' ? (
                <View style={styles.formSection}>
                  <View style={styles.authGroup}>
                    <Text style={styles.fieldLabel}>Phone Number or Email</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === 'phoneOrEmail' && styles.inputFocused,
                      ]}
                    >
                      <Ionicons
                        name={phoneOrEmail.includes('@') ? 'mail-outline' : 'call-outline'}
                        size={18}
                        color={focusedField === 'phoneOrEmail' ? ElixColors.blue : ElixColors.inkMuted}
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        value={phoneOrEmail}
                        onChangeText={setPhoneOrEmail}
                        placeholder="9876543210 or name@example.com"
                        placeholderTextColor={ElixColors.inkMuted}
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
                    <Text style={styles.helperText}>
                      We'll send a 6-digit code via WhatsApp & Email
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                    onPress={handleSendOtp}
                    disabled={isLoading}
                    activeOpacity={0.88}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={ElixColors.white} size="small" />
                    ) : (
                      <View style={styles.btnRow}>
                        <Ionicons
                          name="paper-plane-outline"
                          size={17}
                          color={ElixColors.white}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.primaryBtnText}>Get Verification Code</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formSection}>
                  <View style={styles.authGroup}>
                    <Text style={styles.fieldLabel}>6-Digit Code</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        styles.otpInputContainer,
                        focusedField === 'otpCode' && styles.inputFocused,
                      ]}
                    >
                      <TextInput
                        style={styles.otpTextInput}
                        value={otpCode}
                        onChangeText={setOtpCode}
                        placeholder="••••••"
                        placeholderTextColor={ElixColors.inkMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        onFocus={() => setFocusedField('otpCode')}
                        onBlur={() => setFocusedField(null)}
                        returnKeyType="done"
                        onSubmitEditing={handleVerifyOtp}
                        editable={!isLoading}
                        autoFocus
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={isLoading}
                    activeOpacity={0.88}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={ElixColors.white} size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Confirm & Sign In</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.resendWrapper}>
                    <TouchableOpacity
                      onPress={handleResendOtp}
                      disabled={countdown > 0}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.inlineLink, countdown > 0 && styles.linkMuted]}>
                        {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setOtpStep('request');
                        setOtpCode('');
                        setError('');
                      }}
                      activeOpacity={0.7}
                      style={{ marginTop: 10 }}
                    >
                      <Text style={styles.changeTargetLink}>← Change phone or email</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ── TAB 2: PASSWORD FLOW ──────────────────────────────────────── */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {authMode === 'password' && otpStep === 'request' && (
            <View style={styles.formSection}>
              {/* Username or Email */}
              <View style={styles.authGroup}>
                <Text style={styles.fieldLabel}>Username or Email</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'identifier' && styles.inputFocused,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={focusedField === 'identifier' ? ElixColors.blue : ElixColors.inkMuted}
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="Enter your username or email"
                    placeholderTextColor={ElixColors.inkMuted}
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

              {/* Password */}
              <View style={styles.authGroup}>
                <View style={styles.authLabelRow}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        'Forgot Password',
                        'You can switch to the "Quick OTP" tab above to sign in instantly without needing your password.'
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
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={focusedField === 'password' ? ElixColors.blue : ElixColors.inkMuted}
                    style={styles.inputLeadingIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={ElixColors.inkMuted}
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
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={ElixColors.inkMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me */}
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Ionicons name="checkmark" size={13} color={ElixColors.white} />}
                </View>
                <Text style={styles.rememberText}>Remember Me</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                onPress={handlePasswordLogin}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator color={ElixColors.white} size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign In with Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ── SOCIAL LOGINS (Compact Side-by-Side) ──────────────────────── */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {otpStep === 'request' && (
            <>
              <View style={styles.tierDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                {/* GOOGLE */}
                <TouchableOpacity
                  style={styles.socialPillBtn}
                  onPress={handleGoogleLogin}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-google" size={17} color="#EA4335" />
                  <Text style={styles.socialPillText}>Google</Text>
                </TouchableOpacity>

                {/* APPLE */}
                <TouchableOpacity
                  style={styles.socialPillBtn}
                  onPress={handleAppleLogin}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-apple" size={18} color={ElixColors.ink} />
                  <Text style={styles.socialPillText}>Apple</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Footer Signup Link */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>
              Don't have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => router.push('/auth/signup')}
              >
                Sign up
              </Text>
            </Text>
          </View>
        </View>

        {/* Back to Home Link */}
        <TouchableOpacity
          style={styles.backLinkWrap}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
        >
          <Text style={styles.backLinkText}>← Back to Elix</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
      <BottomNav activeTab="profile" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ElixColors.surface1, // #F8FAFC
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Shell Logo
  logoWrap: {
    marginBottom: 20,
    alignItems: 'center',
  },
  brandLogo: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 30,
    fontWeight: '700',
    color: ElixColors.ink,
    letterSpacing: -0.5,
  },
  brandLogoAccent: {
    color: ElixColors.blue,
    fontStyle: 'italic',
  },
  brandTagline: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    letterSpacing: 1.5,
  },

  // Auth Card
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: ElixColors.surface2, // #FFFFFF
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.md,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: ElixColors.ink,
    lineHeight: 30,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    lineHeight: 20,
  },
  boldText: {
    color: ElixColors.ink,
    fontWeight: '600',
  },
  inlineLink: {
    color: ElixColors.blue,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  linkMuted: {
    color: ElixColors.inkMuted,
    textDecorationLine: 'none',
  },

  // Alert Box
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },

  // ── Segmented Switcher ──────────────────────────────────────────────────────
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9', // light slate fill
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...ElixShadows.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },
  segmentTextActive: {
    color: ElixColors.ink,
    fontWeight: '700',
  },
  recomBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  recomBadgeActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  recomBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    textTransform: 'uppercase',
  },
  recomBadgeTextActive: {
    color: ElixColors.blue,
  },

  // Form Section
  formSection: {
    width: '100%',
  },
  authGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.ink,
    marginBottom: 7,
  },
  authLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  forgotLink: {
    fontSize: 12,
    color: ElixColors.blue,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    marginTop: 6,
  },

  // Input Container with leading icons
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    borderRadius: 12,
    backgroundColor: ElixColors.surface1, // #F8FAFC
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: ElixColors.blue,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: ElixColors.ink,
    height: '100%',
  },

  // OTP specific input
  otpInputContainer: {
    height: 54,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  otpTextInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: ElixColors.ink,
  },
  passwordToggle: {
    padding: 6,
  },

  // Remember Me
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  checkbox: {
    width: 17,
    height: 17,
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
    fontWeight: '500',
    color: ElixColors.inkSoft,
  },

  // Primary Action Button
  primaryBtn: {
    height: 50,
    backgroundColor: ElixColors.blue, // #4F46E5
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ElixColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnText: {
    color: ElixColors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },

  // Resend Wrapper
  resendWrapper: {
    alignItems: 'center',
    marginTop: 16,
  },
  changeTargetLink: {
    fontSize: 13,
    color: ElixColors.blue,
    fontWeight: '600',
  },

  // Tier Divider
  tierDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ElixColors.borderHairline,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
  },

  // Compact Social Row (Side-by-side)
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    paddingHorizontal: 12,
    gap: 8,
  },
  socialPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.ink,
  },

  // Card Footer
  cardFooter: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ElixColors.borderHairline,
  },
  cardFooterText: {
    fontSize: 13,
    color: ElixColors.inkMuted,
  },
  footerLink: {
    color: ElixColors.blue,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Back to home
  backLinkWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    fontWeight: '500',
  },
});
