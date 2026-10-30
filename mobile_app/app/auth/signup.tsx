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
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function SignupScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Focus states
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [verifiedToast, setVerifiedToast] = useState<string | null>(null);

  // ── Verification States (At least ONE required: Phone OR Email) ───────────
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // ── OTP Popup Modal States ────────────────────────────────────────────────
  const [isVerifyModalVisible, setIsVerifyModalVisible] = useState(false);
  const [verifyChannel, setVerifyChannel] = useState<'phone' | 'email'>('phone');
  const [targetValue, setTargetValue] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const { signup, requestVerificationCode, verifyCode, isLoading } = useAuthStore();

  // Countdown timer for OTP resend in popup
  useEffect(() => {
    let timer: any;
    if (isVerifyModalVisible && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isVerifyModalVisible, countdown]);

  // Auto-dismiss verified toast
  useEffect(() => {
    if (verifiedToast) {
      const timer = setTimeout(() => setVerifiedToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [verifiedToast]);

  // ── REQUEST VERIFICATION CODE ─────────────────────────────────────────────
  async function handleStartVerification(channel: 'phone' | 'email') {
    setError('');
    setModalError('');

    if (channel === 'phone') {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 10) {
        setError('Please enter a valid 10-digit Indian phone number first.');
        return;
      }
      setIsSendingCode(true);
      const res = await requestVerificationCode(
        cleanPhone,
        'phone',
        'Mobile Verification for Elix Signup'
      );
      setIsSendingCode(false);

      if (res.ok && res.verification_id) {
        setVerificationId(res.verification_id);
        setVerifyChannel('phone');
        setTargetValue(cleanPhone);
        setDevCode(res.dev_code || null);
        setOtpInput(res.dev_code || '');
        setCountdown(60);
        setIsVerifyModalVisible(true);
      } else {
        setError(res.error || 'Failed to dispatch SMS/WhatsApp verification code.');
      }
    } else {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('Please enter a valid email address first.');
        return;
      }
      setIsSendingCode(true);
      const res = await requestVerificationCode(
        cleanEmail,
        'email',
        'Email Verification for Elix Signup'
      );
      setIsSendingCode(false);

      if (res.ok && res.verification_id) {
        setVerificationId(res.verification_id);
        setVerifyChannel('email');
        setTargetValue(cleanEmail);
        setDevCode(res.dev_code || null);
        setOtpInput(res.dev_code || '');
        setCountdown(60);
        setIsVerifyModalVisible(true);
      } else {
        setError(res.error || 'Failed to dispatch email verification code.');
      }
    }
  }

  // ── CONFIRM OTP IN POPUP ──────────────────────────────────────────────────
  async function handleConfirmCode() {
    setModalError('');
    const code = otpInput.trim();
    if (!code || code.length < 4) {
      setModalError('Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingCode(true);
    const res = await verifyCode(verificationId, code);
    setIsVerifyingCode(false);

    if (res.ok || res.verified) {
      if (verifyChannel === 'phone') {
        setIsPhoneVerified(true);
        setVerifiedToast('Mobile Number verified successfully! ✓');
      } else {
        setIsEmailVerified(true);
        setVerifiedToast('Email Address verified successfully! ✓');
      }
      setIsVerifyModalVisible(false);
      setError('');
    } else {
      setModalError(res.error || 'Incorrect or expired code. Please try again.');
    }
  }

  // ── RESEND OTP IN POPUP ───────────────────────────────────────────────────
  async function handleResendCode() {
    if (countdown > 0) return;
    setModalError('');
    setIsSendingCode(true);
    const res = await requestVerificationCode(
      targetValue,
      verifyChannel,
      verifyChannel === 'phone'
        ? 'Mobile Verification for Elix Signup'
        : 'Email Verification for Elix Signup'
    );
    setIsSendingCode(false);

    if (res.ok && res.verification_id) {
      setVerificationId(res.verification_id);
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setOtpInput(res.dev_code);
      }
      setCountdown(60);
      Alert.alert('Code Sent', `A new verification code has been dispatched to ${targetValue}.`);
    } else {
      setModalError(res.error || 'Failed to resend code.');
    }
  }

  // ── SIGNUP SUBMIT ──────────────────────────────────────────────────────────
  async function handleSignup() {
    setError('');

    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    // ── ANY ONE VERIFICATION REQUIRED ────────────────────────────────────────
    if (!isPhoneVerified && !isEmailVerified) {
      setError(
        'Verification required: Please verify either your Mobile Number or Email Address to complete sign up.'
      );
      return;
    }

    if (age && (parseInt(age, 10) < 13 || parseInt(age, 10) > 120)) {
      setError('Age must be between 13 and 120.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    const result = await signup({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      age: age ? parseInt(age, 10) : undefined,
      password,
    });

    if (result.ok) {
      Alert.alert('Welcome to Elix', 'Your account has been created successfully!', [
        {
          text: redirect === 'booking' ? 'Proceed to Booking' : 'Start Exploring',
          onPress: () => {
            if (redirect === 'booking' || redirect === 'cart') {
              router.replace({ pathname: '/(tabs)/services', params: { openBooking: '1' } });
            } else {
              router.replace('/(tabs)');
            }
          },
        },
      ]);
    } else {
      setError(result.error ?? 'Registration failed. Please check your details.');
    }
  }

  function handleThirdPartyNotice(provider: string) {
    Alert.alert(
      provider,
      `${provider} sign up will link your profile securely. For instant testing, you can sign up directly below.`
    );
  }

  const anyVerified = isPhoneVerified || isEmailVerified;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Logo Header */}
        <TouchableOpacity
          style={styles.logoRow}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.brandLogo}>
            <Text style={styles.brandLogoAccent}>E</Text>LIX
          </Text>
        </TouchableOpacity>

        {/* Auth Card */}
        <View style={styles.card}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSubtitle}>
              Already have an account?{' '}
              <Text style={styles.inlineLink} onPress={() => router.push('/auth/login')}>
                Sign In
              </Text>
            </Text>
          </View>

          {/* Toast / Success Notification */}
          {verifiedToast ? (
            <View style={styles.toastBox}>
              <Ionicons name="checkmark-circle" size={18} color={ElixColors.greenDeep} />
              <Text style={styles.toastText}>{verifiedToast}</Text>
            </View>
          ) : null}

          {/* Alert error box */}
          {error ? (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {/* Verification Rule Notice */}
          <View style={[styles.ruleNotice, anyVerified && styles.ruleNoticeDone]}>
            <Ionicons
              name={anyVerified ? 'shield-checkmark' : 'information-circle'}
              size={18}
              color={anyVerified ? ElixColors.greenDeep : ElixColors.blue}
            />
            <Text style={[styles.ruleNoticeText, anyVerified && styles.ruleNoticeTextDone]}>
              {isPhoneVerified && isEmailVerified
                ? 'Both Mobile and Email are verified!'
                : isPhoneVerified
                ? 'Mobile verified! Email verification is optional.'
                : isEmailVerified
                ? 'Email verified! Mobile verification is optional.'
                : 'Verify at least one: Mobile Number or Email Address to complete sign up.'}
            </Text>
          </View>

          {/* Social Quick Signup */}
          <View style={styles.socialList}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleThirdPartyNotice('Apple')}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={19} color={ElixColors.ink} />
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleThirdPartyNotice('Google')}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN UP WITH DETAILS</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Signup Form */}
          <View style={styles.form}>
            {/* NAME ROW */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>FIRST NAME:</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'firstName' && styles.inputFocused,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Priya"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>LAST NAME:</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'lastName' && styles.inputFocused,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Sharma"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                    editable={!isLoading}
                  />
                </View>
              </View>
            </View>

            {/* EMAIL (WITH INLINE VERIFY ACTION) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelActionRow}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS:</Text>
                {isEmailVerified ? (
                  <View style={styles.verifiedChip}>
                    <Ionicons name="checkmark-circle" size={13} color={ElixColors.greenDeep} />
                    <Text style={styles.verifiedChipText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={() => handleStartVerification('email')}
                    disabled={isSendingCode}
                    hitSlop={6}
                  >
                    <Ionicons name="shield-outline" size={12} color={ElixColors.blue} />
                    <Text style={styles.verifyBtnText}>Verify Email</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'email' && styles.inputFocused,
                  isEmailVerified && styles.inputContainerVerified,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (isEmailVerified) setIsEmailVerified(false);
                  }}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
                {isEmailVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={ElixColors.green}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
            </View>

            {/* PHONE NUMBER (WITH INLINE VERIFY ACTION) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelActionRow}>
                <Text style={styles.fieldLabel}>PHONE NUMBER:</Text>
                {isPhoneVerified ? (
                  <View style={styles.verifiedChip}>
                    <Ionicons name="checkmark-circle" size={13} color={ElixColors.greenDeep} />
                    <Text style={styles.verifiedChipText}>Verified</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.verifyBtn}
                    onPress={() => handleStartVerification('phone')}
                    disabled={isSendingCode}
                    hitSlop={6}
                  >
                    <Ionicons name="shield-outline" size={12} color={ElixColors.blue} />
                    <Text style={styles.verifyBtnText}>Verify Mobile</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'phone' && styles.inputFocused,
                  isPhoneVerified && styles.inputContainerVerified,
                ]}
              >
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    if (isPhoneVerified) setIsPhoneVerified(false);
                  }}
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
                {isPhoneVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={ElixColors.green}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
            </View>

            {/* AGE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>AGE (OPTIONAL):</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'age' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="24"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={3}
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PASSWORD:</Text>
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
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
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

            {/* CONFIRM PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD:</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'confirmPassword' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  hitSlop={10}
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={ElixColors.inkMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSignup}
              disabled={isLoading || isSendingCode}
              activeOpacity={0.85}
            >
              {isLoading || isSendingCode ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── ON-PAGE OTP VERIFICATION POPUP MODAL ────────────────────────────── */}
      <Modal
        visible={isVerifyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVerifyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalTopRow}>
              <View style={styles.modalIconCircle}>
                <Ionicons
                  name={verifyChannel === 'phone' ? 'call' : 'mail'}
                  size={22}
                  color={ElixColors.blue}
                />
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsVerifyModalVisible(false)}
                hitSlop={10}
                accessibilityLabel="Close verification modal"
              >
                <Ionicons name="close" size={20} color={ElixColors.inkMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>
              Verify {verifyChannel === 'phone' ? 'Mobile Number' : 'Email Address'}
            </Text>
            <Text style={styles.modalSubtitle}>
              We sent a 6-digit verification code to{' '}
              <Text style={{ fontWeight: '700', color: ElixColors.ink }}>
                {verifyChannel === 'phone' ? `+91 ${targetValue}` : targetValue}
              </Text>
              . Enter it below to verify.
            </Text>

            {modalError ? (
              <View style={styles.modalAlert}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.modalAlertText}>{modalError}</Text>
              </View>
            ) : null}

            {/* OTP 6-Digit Input */}
            <View style={styles.modalInputWrap}>
              <TextInput
                style={styles.modalOtpInput}
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="000000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                returnKeyType="done"
              />
            </View>

            {devCode ? (
              <View style={styles.devHintWrap}>
                <Text style={styles.devHintText}>
                  Dev auto-fill: <Text style={{ fontWeight: '800' }}>{devCode}</Text>
                </Text>
              </View>
            ) : null}

            {/* Resend Row */}
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive code? </Text>
              {countdown > 0 ? (
                <Text style={styles.countdownText}>Resend in {countdown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode} disabled={isSendingCode}>
                  <Text style={styles.resendBtnText}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalVerifyBtn}
                onPress={handleConfirmCode}
                disabled={isVerifyingCode}
                activeOpacity={0.85}
              >
                {isVerifyingCode ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalVerifyBtnText}>Verify & Confirm</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsVerifyModalVisible(false)}
                disabled={isVerifyingCode}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 20,
    alignItems: 'center',
  },
  brandLogo: {
    fontSize: 32,
    fontWeight: '900',
    color: ElixColors.ink,
    letterSpacing: 2,
  },
  brandLogoAccent: {
    color: ElixColors.blue,
  },

  // Card
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
    fontSize: 26,
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

  // Rule Notice
  ruleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ElixColors.blueLight,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: ElixRadii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  ruleNoticeDone: {
    backgroundColor: ElixColors.greenLight,
    borderColor: '#A7F3D0',
  },
  ruleNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.blue,
    lineHeight: 16,
  },
  ruleNoticeTextDone: {
    color: ElixColors.greenDeep,
  },

  // Toast
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ElixColors.greenLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: ElixRadii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.greenDeep,
  },

  // Alert
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
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
    color: '#B91C1C',
    fontWeight: ElixTypography.weights.medium,
    lineHeight: 18,
  },

  // Social
  socialList: {
    gap: 10,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
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

  // Divider
  dividerWrap: {
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
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
  },

  // Form
  form: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ElixColors.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ElixRadii.pill,
  },
  verifyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: ElixColors.blue,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ElixColors.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ElixRadii.pill,
  },
  verifiedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: ElixColors.greenDeep,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
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
  inputContainerVerified: {
    borderColor: ElixColors.green,
    backgroundColor: '#F0FDF4',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: ElixColors.ink,
    height: '100%',
  },
  phonePrefix: {
    paddingRight: 8,
    marginRight: 6,
    borderRightWidth: 1,
    borderRightColor: ElixColors.borderHairlineMedium,
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  toggleBtn: {
    padding: 6,
  },

  // Submit Button
  submitBtn: {
    marginTop: 8,
    height: 50,
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

  // ── POPUP MODAL STYLES ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    ...ElixShadows.md,
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ElixColors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: ElixColors.ink,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  modalAlertText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  modalInputWrap: {
    borderWidth: 2,
    borderColor: ElixColors.blue,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalOtpInput: {
    fontSize: 24,
    fontWeight: '800',
    color: ElixColors.ink,
    letterSpacing: 10,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    paddingVertical: 0,
  },
  devHintWrap: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
    marginBottom: 10,
  },
  devHintText: {
    fontSize: 11,
    color: ElixColors.blue,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    gap: 4,
  },
  resendText: {
    fontSize: 12,
    color: ElixColors.inkMuted,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.inkMuted,
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.blue,
    textDecorationLine: 'underline',
  },
  modalBtnRow: {
    gap: 8,
  },
  modalVerifyBtn: {
    height: 48,
    borderRadius: ElixRadii.pill,
    backgroundColor: ElixColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalVerifyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalCancelBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },
});
