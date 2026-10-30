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
import { initiateSocialSignIn } from '@/lib/socialAuth';
import { BottomNav } from '@/components/ui/BottomNav';

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
        {/* Brand Logo Header */}
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
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSubtitle}>
              Already have an account?{' '}
              <Text
                style={styles.inlineLink}
                onPress={() => router.push('/auth/login')}
              >
                Sign in
              </Text>
            </Text>
          </View>

          {/* Alert error box */}
          {error ? (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {/* Compact Side-by-Side Social */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialPillBtn}
              onPress={handleGoogleLogin}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={17} color="#EA4335" />
              <Text style={styles.socialPillText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialPillBtn}
              onPress={handleAppleLogin}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={18} color={ElixColors.ink} />
              <Text style={styles.socialPillText}>Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
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
                <Text style={styles.fieldLabel}>First Name</Text>
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
                    placeholderTextColor={ElixColors.inkMuted}
                    autoCapitalize="words"
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Last Name</Text>
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
                    placeholderTextColor={ElixColors.inkMuted}
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
              <Text style={styles.fieldLabel}>Email Address</Text>
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
                  placeholderTextColor={ElixColors.inkMuted}
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
              <Text style={styles.fieldLabel}>Phone Number</Text>
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
                  placeholderTextColor={ElixColors.inkMuted}
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
              <Text style={styles.fieldLabel}>Age (Optional)</Text>
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
                  placeholderTextColor={ElixColors.inkMuted}
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
              <Text style={styles.fieldLabel}>Password</Text>
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
                  placeholderTextColor={ElixColors.inkMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.toggleBtn}
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

            {/* CONFIRM PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
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
                  placeholderTextColor={ElixColors.inkMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={ElixColors.inkMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* SUBMIT BUTTON — matching web `.auth-submit-btn` with Indigo Royal Blue */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSignup}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              {isLoading ? (
                <ActivityIndicator color={ElixColors.white} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Sign Up</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Back link */}
        <TouchableOpacity
          style={styles.backLinkWrap}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
        >
          <Text style={styles.backLinkText}>← Back to Elix</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
  logoWrap: {
    marginBottom: 20,
    alignItems: 'center',
  },
  brandLogo: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28,
    fontWeight: '600',
    color: ElixColors.ink,
    letterSpacing: -0.5,
  },
  brandLogoAccent: {
    color: ElixColors.blue, // #4F46E5
    fontStyle: 'italic',
  },
  brandTagline: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    letterSpacing: 1.5,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: ElixColors.surface2, // #FFFFFF
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: ElixColors.ink,
    lineHeight: 32,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    lineHeight: 20,
  },
  inlineLink: {
    color: ElixColors.blue, // #4F46E5
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Alert
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
    fontSize: 11,
    fontWeight: '700',
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
    fontWeight: '700',
    color: ElixColors.inkMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    borderRadius: 12,
    backgroundColor: ElixColors.surface1,
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: ElixColors.blue,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
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
    fontWeight: '700',
    color: ElixColors.ink,
  },
  toggleBtn: {
    padding: 6,
  },

  // Submit Button
  submitBtn: {
    marginTop: 8,
    height: 52,
    backgroundColor: ElixColors.blue, // #4F46E5 Indigo Royal Blue
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ElixColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: ElixColors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // Back link
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
