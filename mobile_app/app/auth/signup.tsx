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
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

export default function SignupScreen() {
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

  const { signup, isLoading } = useAuthStore();

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
        { text: 'Start Exploring', onPress: () => router.replace('/(tabs)') },
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

        {/* Auth Card matching Web .auth-card */}
        <View style={styles.card}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sign Up</Text>
            <Text style={styles.cardSubtitle}>
              Already have an account? Then please{' '}
              <Text
                style={styles.inlineLink}
                onPress={() => router.push('/auth/login')}
              >
                sign in
              </Text>
              .
            </Text>
          </View>

          {/* Alert error box matching web .auth-card__alert */}
          {error ? (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {/* Social Quick Signup matching Web .auth-social-list */}
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

          {/* Divider matching web .auth-divider */}
          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN UP WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Signup Form */}
          <View style={styles.form}>
            {/* NAME ROW (FIRST NAME + LAST NAME) */}
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

            {/* EMAIL */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL:</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'email' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* PHONE NUMBER */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PHONE NUMBER:</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'phone' && styles.inputFocused,
                ]}
              >
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* AGE */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>AGE:</Text>
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

            {/* SUBMIT BUTTON matching .auth-submit-btn */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#16120F" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
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
    color: ElixColors.gold,
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
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    lineHeight: 20,
  },
  inlineLink: {
    color: ElixColors.gold,
    fontWeight: ElixTypography.weights.bold,
    textDecorationLine: 'underline',
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
    color: '#DC2626',
    fontWeight: ElixTypography.weights.medium,
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
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
    borderColor: ElixColors.gold,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
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
    height: 52,
    backgroundColor: '#D97706',
    borderRadius: ElixRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#16120F',
    fontSize: 15,
    fontWeight: ElixTypography.weights.bold,
    letterSpacing: 0.2,
  },
});
