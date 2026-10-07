import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useProfile, useAddresses, useDeleteAddress } from '@/hooks/useProfile';

export default function ProfileScreen() {
  const { isLoggedIn, user, logout } = useAuthStore();
  const { data: profile, isLoading: profileLoading } = useProfile(isLoggedIn);
  const { data: addresses, isLoading: addrLoading } = useAddresses(isLoggedIn);
  const deleteAddress = useDeleteAddress();

  const openWhatsAppSupport = () => {
    Linking.openURL('https://wa.me/917440670533?text=Hello%20Elix%20Support,%20I%20need%20help%20with%20my%20salon%20booking');
  };

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  function handleDeleteAddress(id: number) {
    Alert.alert('Remove Address', 'Remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteAddress.mutate(id),
      },
    ]);
  }

  const displayName = profile
    ? (profile.user.first_name + ' ' + profile.user.last_name).trim() || profile.user.email
    : user
    ? (user.first_name + ' ' + user.last_name).trim() || user.email
    : 'Guest';

  const displayEmail = profile?.user.email ?? user?.email ?? '';
  const displayPhone = profile?.phone ?? '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header location="Indore, MP" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={ElixColors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{displayName}</Text>
            {displayPhone ? (
              <Text style={styles.userPhone}>{displayPhone}</Text>
            ) : (
              <Text style={styles.userEmail}>{displayEmail}</Text>
            )}
            <View style={{ marginTop: 4 }}>
              <Badge label="Verified" variant="discount" />
            </View>
          </View>
          {!isLoggedIn && (
            <Pressable style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <Pressable><Text style={styles.linkText}>+ Add New</Text></Pressable>
          </View>
          {addrLoading && isLoggedIn ? (
            <ActivityIndicator color={ElixColors.blue} style={{ marginVertical: 16 }} />
          ) : addresses && addresses.length > 0 ? (
            addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <View style={styles.addressIconWrap}>
                  <Ionicons name="home" size={18} color={ElixColors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.addressTagRow}>
                    <Text style={styles.addressLabel}>{addr.label}</Text>
                    {addr.pincode ? <Badge label={addr.pincode} variant="neutral" /> : null}
                  </View>
                  <Text style={styles.addressText}>{addr.text}</Text>
                </View>
                <Pressable onPress={() => handleDeleteAddress(addr.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={ElixColors.inkMuted} />
                </Pressable>
              </View>
            ))
          ) : (
            <View style={styles.addressCard}>
              <View style={styles.addressIconWrap}>
                <Ionicons name="location-outline" size={18} color={ElixColors.inkMuted} />
              </View>
              <Text style={styles.addressText}>
                {isLoggedIn ? 'No saved addresses yet.' : 'Sign in to see your saved addresses.'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences and Support</Text>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={openWhatsAppSupport}>
              <View style={[styles.menuIcon, { backgroundColor: ElixColors.greenLight }]}>
                <Ionicons name="logo-whatsapp" size={18} color={ElixColors.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>WhatsApp Support</Text>
                <Text style={styles.menuItemSubtitle}>Direct chat with Indore customer care</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ElixColors.inkMuted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="notifications-outline" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Notifications</Text>
                <Text style={styles.menuItemSubtitle}>Booking updates and offers</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ElixColors.inkMuted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Terms and Privacy</Text>
                <Text style={styles.menuItemSubtitle}>Our policies</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ElixColors.inkMuted} />
            </Pressable>
          </View>
        </View>

        {isLoggedIn ? (
          <View style={styles.section}>
            <Button title="Sign Out" variant="outline" onPress={handleLogout} style={styles.logoutBtn} textStyle={{ color: '#DC2626' }} />
          </View>
        ) : (
          <View style={styles.section}>
            <Button title="Sign In to Your Account" variant="primary" onPress={() => router.push('/auth/login')} />
          </View>
        )}

        <Text style={styles.versionText}>Elix v1.0.0 - Made in Indore</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ElixColors.surface1 },
  container: { flex: 1 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: ElixRadii.lg,
    padding: 16,
    gap: 12,
    ...ElixShadows.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontSize: 17, fontWeight: '700', color: ElixColors.ink, marginBottom: 2 },
  userPhone: { fontSize: 13, color: ElixColors.inkMuted },
  userEmail: { fontSize: 13, color: ElixColors.inkMuted },
  signInBtn: {
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signInBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: ElixColors.ink },
  linkText: { fontSize: 13, color: ElixColors.blue, fontWeight: '600' },
  addressCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
    ...ElixShadows.md,
  },
  addressIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  addressLabel: { fontSize: 13, fontWeight: '700', color: ElixColors.ink },
  addressText: { fontSize: 13, color: ElixColors.inkMuted, lineHeight: 18 },
  menuCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.lg,
    overflow: 'hidden',
    ...ElixShadows.md,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuItemTitle: { fontSize: 14, fontWeight: '600', color: ElixColors.ink },
  menuItemSubtitle: { fontSize: 12, color: ElixColors.inkMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 60 },
  logoutBtn: { borderColor: '#DC2626' },
  versionText: { textAlign: 'center', fontSize: 12, color: ElixColors.inkMuted, marginTop: 20 },
});
