import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useProfile, useAddresses, useDeleteAddress, useAddAddress, useUpdateAddress, useUpdateProfile, useChangePassword } from '@/hooks/useProfile';
import { getCurrentCoordinates, reverseGeocodeGoogle, searchPlacesGoogle, getPlaceDetailsGoogle, LocationCoords, PlacePrediction, POPULAR_INDORE_LOCALITIES } from '@/lib/googleMaps';
import { GoogleMapView } from '@/components/booking/GoogleMapView';
import type { Address } from '@/types/api';

function getAddressIcon(label: string) {
  const l = (label || '').toLowerCase();
  if (l.includes('home')) return 'home';
  if (l.includes('work') || l.includes('office')) return 'briefcase';
  return 'location';
}

export default function ProfileScreen() {
  const { isLoggedIn, user, logout, updateUser } = useAuthStore();
  const { totalItems } = useCartStore();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile(isLoggedIn);
  const { data: addresses, isLoading: addrLoading } = useAddresses(isLoggedIn);
  const deleteAddress = useDeleteAddress();
  const addAddress = useAddAddress();
  const updateAddress = useUpdateAddress();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // Address Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<number | null>(null);
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [addressText, setAddressText] = useState('');
  const [pincode, setPincode] = useState('');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationInfo, setLocationInfo] = useState('');
  const [addressError, setAddressError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);

  // Edit Profile Modal State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfileError, setEditProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessModal, setPasswordSuccessModal] = useState(false);

  // Sign out modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const openWhatsAppSupport = () => {
    Linking.openURL('https://wa.me/917440670533?text=Hello%20Elix%20Support,%20I%20need%20help%20with%20my%20salon%20booking');
  };

  function handleOpenEditProfile() {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    setEditProfileError('');
    setEditFirstName(profile?.user?.first_name ?? user?.first_name ?? '');
    setEditLastName(profile?.user?.last_name ?? user?.last_name ?? '');
    setEditPhone(profile?.phone ?? user?.phone ?? '');
    setShowEditProfileModal(true);
  }

  async function handleSaveProfile() {
    setEditProfileError('');
    const first = editFirstName.trim();
    const last = editLastName.trim();
    const rawPhone = editPhone.trim();

    if (!first) {
      setEditProfileError('First name cannot be empty.');
      return;
    }

    let cleanPhone = '';
    if (rawPhone) {
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length === 10) {
        cleanPhone = `+91${digits}`;
      } else if (digits.length === 12 && digits.startsWith('91')) {
        cleanPhone = `+${digits}`;
      } else {
        setEditProfileError('Please enter a valid 10-digit Indian phone number.');
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      await updateProfile.mutateAsync({
        first_name: first,
        last_name: last,
        phone: cleanPhone,
      });
      await updateUser({
        first_name: first,
        last_name: last,
        phone: cleanPhone,
      });
      setShowEditProfileModal(false);
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to update profile. Please try again.';
      setEditProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleOpenChangePassword() {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowChangePasswordModal(true);
  }

  async function handleSavePassword() {
    setChangePasswordError('');
    if (!currentPassword) {
      setChangePasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setChangePasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setChangePasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setChangePasswordError('New password cannot be the same as your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setShowChangePasswordModal(false);
      setPasswordSuccessModal(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not change password. Please check your current password.';
      setChangePasswordError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function performSignOut() {
    setIsLoggingOut(true);
    try {
      await logout();
      queryClient.clear();
      setShowLogoutModal(false);
      setIsLoggingOut(false);
      router.replace('/auth/login');
    } catch {
      queryClient.clear();
      setShowLogoutModal(false);
      setIsLoggingOut(false);
      router.replace('/auth/login');
    }
  }

  function handleLogout() {
    setShowLogoutModal(true);
  }

  function handleDeleteAddress(id: number) {
    setAddressToDelete(id);
  }

  function confirmDeleteAddress() {
    if (addressToDelete !== null) {
      deleteAddress.mutate(addressToDelete);
      setAddressToDelete(null);
    }
  }

  function handleOpenAddAddress() {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    setEditingAddressId(null);
    setAddressError('');
    setLocationInfo('');
    setAddressText('');
    setPincode('');
    setCoords(null);
    setLabel('Home');
    setCustomLabel('');
    setSearchQuery('');
    setPredictions([]);
    setSearching(false);
    setShowAddModal(true);
  }

  function handleOpenEditAddress(addr: Address) {
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    setEditingAddressId(addr.id);
    setAddressError('');
    setLocationInfo(addr.lat && addr.lng ? `Saved GPS: ${addr.lat.toFixed(4)}, ${addr.lng.toFixed(4)}` : '');
    setAddressText(addr.text || '');
    setPincode(addr.pincode || '');
    setCoords(addr.lat && addr.lng ? { lat: addr.lat, lng: addr.lng } : null);
    if (addr.label === 'Home' || addr.label === 'Work') {
      setLabel(addr.label);
      setCustomLabel('');
    } else {
      setLabel('Other');
      setCustomLabel(addr.label || '');
    }
    setSearchQuery('');
    setPredictions([]);
    setSearching(false);
    setShowAddModal(true);
  }

  async function handleSearchChange(text: string) {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchPlacesGoogle(text);
      setPredictions(results);
    } catch {
      setPredictions([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectPrediction(item: PlacePrediction) {
    setSearching(true);
    setPredictions([]);
    setSearchQuery('');
    try {
      const details = await getPlaceDetailsGoogle(item.place_id);
      if (details.ok && details.address) {
        setAddressText(details.address);
        if (details.pincode) setPincode(details.pincode);
        if (details.lat && details.lng) {
          setCoords({ lat: details.lat, lng: details.lng });
          setLocationInfo(`Selected: ${details.address}`);
        }
      } else {
        setAddressText(item.description);
      }
    } catch {
      setAddressText(item.description);
    } finally {
      setSearching(false);
    }
  }

  async function handleUseCurrentLocation() {
    setAddressError('');
    setLocationInfo('');
    setLocating(true);
    try {
      const pos = await getCurrentCoordinates();
      setCoords(pos);
      const res = await reverseGeocodeGoogle(pos.lat, pos.lng);
      if (res.ok && res.address) {
        setAddressText(res.address);
        if (res.pincode) setPincode(res.pincode);
        setLocationInfo(`Google Maps coordinates acquired (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`);
      } else {
        setLocationInfo(`GPS coords pinned (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}). Please enter street details.`);
      }
    } catch (err: any) {
      setAddressError(err?.message || 'Could not fetch current GPS location.');
    } finally {
      setLocating(false);
    }
  }

  async function handleMapCoordsChange(newCoords: LocationCoords) {
    setCoords(newCoords);
    try {
      const res = await reverseGeocodeGoogle(newCoords.lat, newCoords.lng);
      if (res.ok && res.address) {
        setAddressText(res.address);
        if (res.pincode) setPincode(res.pincode);
        setLocationInfo(`Pin moved (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
      } else {
        setLocationInfo(`Pin moved (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
      }
    } catch {
      setLocationInfo(`Pin moved (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
    }
  }

  async function handleSaveAddress() {
    setAddressError('');
    const trimmedText = addressText.trim();
    if (!trimmedText) {
      setAddressError('Please enter your full address.');
      return;
    }
    const trimmedPin = pincode.trim();
    if (trimmedPin && (trimmedPin.length !== 6 || !/^\d{6}$/.test(trimmedPin))) {
      setAddressError('Please enter a valid 6-digit pincode.');
      return;
    }

    const finalLabel = label === 'Other' && customLabel.trim() ? customLabel.trim() : label;

    setIsSavingAddress(true);
    try {
      if (editingAddressId !== null) {
        await updateAddress.mutateAsync({
          id: editingAddressId,
          label: finalLabel,
          text: trimmedText,
          pincode: trimmedPin,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });
        setShowAddModal(false);
        setEditingAddressId(null);
        setCoords(null);
        Alert.alert('Address Updated', 'Your address has been updated successfully.');
      } else {
        await addAddress.mutateAsync({
          label: finalLabel,
          text: trimmedText,
          pincode: trimmedPin,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });
        setShowAddModal(false);
        setCoords(null);
        Alert.alert('Address Saved', 'New address has been saved successfully.');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || 'Could not save address. Please try again.';
      setAddressError(errMsg);
    } finally {
      setIsSavingAddress(false);
    }
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
      <Header
        location="Indore, MP"
        cartItemCount={totalItems}
        onSearchPress={() => router.push({ pathname: '/(tabs)/services', params: { autoSearch: '1' } })}
        onCartPress={() => router.push({ pathname: '/(tabs)/services', params: { openCart: '1' } })}
      />
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
          {isLoggedIn ? (
            <Pressable
              style={styles.editProfileBtn}
              onPress={handleOpenEditProfile}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={13} color={ElixColors.blue} style={{ marginRight: 4 }} />
              <Text style={styles.editProfileBtnText}>Edit</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <Pressable onPress={handleOpenAddAddress} hitSlop={8}>
              <Text style={styles.linkText}>+ Add New</Text>
            </Pressable>
          </View>
          {addrLoading && isLoggedIn ? (
            <ActivityIndicator color={ElixColors.blue} style={{ marginVertical: 16 }} />
          ) : addresses && addresses.length > 0 ? (
            addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <View style={styles.addressIconWrap}>
                  <Ionicons name={getAddressIcon(addr.label) as any} size={18} color={ElixColors.blue} />
                </View>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <View style={styles.addressTagRow}>
                    <Text style={styles.addressLabel} numberOfLines={1}>
                      {addr.label}
                    </Text>
                    {addr.pincode ? <Badge label={addr.pincode} variant="neutral" /> : null}
                    {addr.lat && addr.lng ? (
                      <View style={styles.profileGpsBadge}>
                        <Ionicons name="location" size={10} color="#166534" />
                        <Text style={styles.profileGpsBadgeText}>GPS Pin</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.addressText}>{addr.text}</Text>
                </View>
                <View style={styles.addressActionRow}>
                  <Pressable
                    onPress={() => handleOpenEditAddress(addr)}
                    hitSlop={8}
                    style={styles.addressEditBtn}
                    accessibilityLabel="Edit address"
                  >
                    <Ionicons name="pencil" size={15} color={ElixColors.blue} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteAddress(addr.id)}
                    hitSlop={8}
                    style={styles.addressDeleteBtn}
                    accessibilityLabel="Delete address"
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.addressCard}>
              <View style={styles.addressIconWrap}>
                <Ionicons name="location-outline" size={18} color={ElixColors.inkMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressText}>
                  {isLoggedIn ? 'No saved addresses yet.' : 'Sign in to see your saved addresses.'}
                </Text>
              </View>
              {isLoggedIn && (
                <Pressable onPress={handleOpenAddAddress} hitSlop={8}>
                  <Text style={styles.linkText}>+ Add</Text>
                </Pressable>
              )}
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
                <Ionicons name="notifications-outline" size={18} color={ElixColors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Notifications</Text>
                <Text style={styles.menuItemSubtitle}>Booking updates and offers</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ElixColors.inkMuted} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.menuItem}>
              <View style={[styles.menuIcon, { backgroundColor: ElixColors.blueLight }]}>
                <Ionicons name="document-text-outline" size={18} color={ElixColors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Terms and Privacy</Text>
                <Text style={styles.menuItemSubtitle}>Our policies</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={ElixColors.inkMuted} />
            </Pressable>
            {isLoggedIn ? (
              <>
                <View style={styles.divider} />
                <Pressable style={styles.menuItem} onPress={handleOpenChangePassword}>
                  <View style={[styles.menuIcon, { backgroundColor: '#FDF4FF' }]}>
                    <Ionicons name="lock-closed-outline" size={18} color="#9333EA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuItemTitle}>Change Password</Text>
                    <Text style={styles.menuItemSubtitle}>Update your login password</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={ElixColors.inkMuted} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {isLoggedIn ? (
          <View style={styles.section}>
            <Button title="Sign Out" variant="outline" onPress={handleLogout} style={styles.logoutBtn} textStyle={{ color: ElixColors.ink }} />
          </View>
        ) : (
          <View style={styles.section}>
            <Button title="Sign In to Your Account" variant="primary" onPress={() => router.push('/auth/login')} />
          </View>
        )}

        <Text style={styles.versionText}>Elix v1.0.0 - Made in Indore</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ADD ADDRESS MODAL */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddModal(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingAddressId ? 'Edit Address' : 'Add New Address'}</Text>
                <Pressable onPress={() => { setShowAddModal(false); setEditingAddressId(null); }} hitSlop={10}>
                  <Ionicons name="close" size={22} color={ElixColors.ink} />
                </Pressable>
              </View>

              {addressError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{addressError}</Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>ADDRESS LABEL</Text>
              <View style={styles.pillRow}>
                {(['Home', 'Work', 'Other'] as const).map((item) => {
                  const active = label === item;
                  return (
                    <Pressable
                      key={item}
                      style={[styles.typePill, active && styles.typePillActive]}
                      onPress={() => setLabel(item)}
                    >
                      <Ionicons
                        name={
                          item === 'Home'
                            ? 'home-outline'
                            : item === 'Work'
                            ? 'briefcase-outline'
                            : 'location-outline'
                        }
                        size={15}
                        color={active ? ElixColors.white : ElixColors.ink}
                      />
                      <Text style={[styles.typePillText, active && styles.typePillTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {label === 'Other' && (
                <View style={{ marginBottom: 12 }}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Custom Label (e.g. Sister's Place)"
                    placeholderTextColor={ElixColors.inkMuted}
                    value={customLabel}
                    onChangeText={setCustomLabel}
                  />
                </View>
              )}

              {/* Google Maps Location Button */}
              <Pressable
                style={[styles.modalLocateBtn, locating && styles.btnDisabled]}
                onPress={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#1D4ED8" />
                ) : (
                  <Ionicons name="navigate-circle" size={18} color="#1D4ED8" />
                )}
                <Text style={styles.modalLocateBtnText}>
                  {locating ? 'Detecting current location…' : 'Use Current Location (GPS - Google Maps)'}
                </Text>
              </Pressable>

              {/* Search Locality or Landmark on Map */}
              <Text style={styles.modalMapLabel}>SEARCH AREA OR LANDMARK ON MAP:</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={ElixColors.inkMuted} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search locality, apartment or landmark in Indore…"
                  placeholderTextColor={ElixColors.inkMuted}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  autoCorrect={false}
                />
                {searching ? (
                  <ActivityIndicator size="small" color={ElixColors.blue} />
                ) : searchQuery ? (
                  <Pressable onPress={() => { setSearchQuery(''); setPredictions([]); }}>
                    <Ionicons name="close-circle" size={16} color={ElixColors.inkMuted} />
                  </Pressable>
                ) : null}
              </View>

              {/* Search Predictions Dropdown */}
              {predictions.length > 0 && (
                <View style={styles.predictionsList}>
                  {predictions.map((p) => (
                    <Pressable
                      key={p.place_id}
                      style={styles.predictionItem}
                      onPress={() => handleSelectPrediction(p)}
                    >
                      <Ionicons name="location-outline" size={16} color={ElixColors.blue} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.predMainText}>{p.main_text}</Text>
                        <Text style={styles.predSubText}>{p.secondary_text || p.description}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Interactive Google Map in Profile Modal */}
              <Text style={styles.modalMapLabel}>PINPOINT ON MAP (TAP OR DRAG PIN):</Text>
              <GoogleMapView
                coords={coords}
                onCoordsChange={handleMapCoordsChange}
                height={170}
              />

              {/* Quick Indore Localities */}
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.modalMapLabel}>POPULAR AREAS (INDORE):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  {POPULAR_INDORE_LOCALITIES.map((loc) => (
                    <Pressable
                      key={loc.name}
                      style={styles.modalLocalityChip}
                      onPress={() => {
                        setCoords({ lat: loc.lat, lng: loc.lng });
                        setAddressText(`${loc.name}, Indore`);
                        setPincode(loc.pincode);
                        setLocationInfo(`Selected locality: ${loc.name}`);
                      }}
                    >
                      <Text style={styles.modalLocalityChipText}>{loc.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {locationInfo ? (
                <View style={styles.modalInfoBox}>
                  <Ionicons name="checkmark-circle" size={14} color="#166534" />
                  <Text style={styles.modalInfoText}>{locationInfo}</Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>COMPLETE ADDRESS *</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Flat / House / Floor No., Apartment or Street Name, Area"
                placeholderTextColor={ElixColors.inkMuted}
                value={addressText}
                onChangeText={setAddressText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>PINCODE (INDORE)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 452001"
                placeholderTextColor={ElixColors.inkMuted}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
                maxLength={6}
              />

              {coords && (
                <View style={styles.coordsIndicator}>
                  <Ionicons name="pin" size={12} color="#4F46E5" />
                  <Text style={styles.coordsText}>
                    Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
                  </Text>
                </View>
              )}

              <View style={styles.modalBtnRow}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => { setShowAddModal(false); setEditingAddressId(null); }}
                  disabled={isSavingAddress || addAddress.isPending || updateAddress.isPending}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalSaveBtn, (isSavingAddress || addAddress.isPending || updateAddress.isPending) && styles.btnDisabled]}
                  onPress={handleSaveAddress}
                  disabled={isSavingAddress || addAddress.isPending || updateAddress.isPending}
                >
                  {isSavingAddress || addAddress.isPending || updateAddress.isPending ? (
                    <ActivityIndicator color={ElixColors.white} size="small" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>{editingAddressId ? 'Update Address' : 'Save Address'}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT PROFILE MODAL ── */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isSavingProfile && setShowEditProfileModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => !isSavingProfile && setShowEditProfileModal(false)}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.editModalIconWrap}>
                    <Ionicons name="person" size={18} color={ElixColors.blue} />
                  </View>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                </View>
                <Pressable
                  onPress={() => !isSavingProfile && setShowEditProfileModal(false)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color={ElixColors.ink} />
                </Pressable>
              </View>

              {editProfileError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{editProfileError}</Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>FIRST NAME *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="First name"
                placeholderTextColor={ElixColors.inkMuted}
                value={editFirstName}
                onChangeText={setEditFirstName}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>LAST NAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Last name"
                placeholderTextColor={ElixColors.inkMuted}
                value={editLastName}
                onChangeText={setEditLastName}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>PHONE NUMBER (10 DIGITS)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.phonePrefixBox}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="9876543210"
                  placeholderTextColor={ElixColors.inkMuted}
                  value={editPhone.replace(/^\+91/, '')}
                  onChangeText={(val) => setEditPhone(val.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS (READ-ONLY)</Text>
                <View style={styles.readOnlyEmailWrap}>
                  <Ionicons name="lock-closed" size={14} color={ElixColors.inkMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.readOnlyEmailText}>{displayEmail || 'No email attached'}</Text>
                </View>
                <Text style={styles.readOnlySubtext}>
                  Email is linked to your login identity and cannot be changed here.
                </Text>
              </View>

              <View style={[styles.modalBtnRow, { marginTop: 20 }]}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setShowEditProfileModal(false)}
                  disabled={isSavingProfile}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalSaveBtn, isSavingProfile && styles.btnDisabled]}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color={ElixColors.white} size="small" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Save Profile</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── IN-APP SIGN OUT POPUP MODAL ── */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => !isLoggingOut && setShowLogoutModal(false)}
          />
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="log-out-outline" size={26} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Sign Out</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to sign out of your Elix account?
            </Text>
            <View style={styles.confirmBtnRow}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.confirmCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmDestructiveBtn, isLoggingOut && styles.btnDisabled]}
                onPress={performSignOut}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmDestructiveBtnText}>Sign Out</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CHANGE PASSWORD MODAL ── */}
      <Modal
        visible={showChangePasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isChangingPassword && setShowChangePasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => !isChangingPassword && setShowChangePasswordModal(false)}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.editModalIconWrap, { backgroundColor: '#FDF4FF' }]}>
                    <Ionicons name="lock-closed" size={18} color="#9333EA" />
                  </View>
                  <Text style={styles.modalTitle}>Change Password</Text>
                </View>
                <Pressable
                  onPress={() => !isChangingPassword && setShowChangePasswordModal(false)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color={ElixColors.ink} />
                </Pressable>
              </View>

              {changePasswordError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{changePasswordError}</Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>CURRENT PASSWORD *</Text>
              <View style={styles.passwordFieldContainer}>
                <TextInput
                  style={[styles.modalInput, styles.passwordInput]}
                  placeholder="Enter current password"
                  placeholderTextColor={ElixColors.inkMuted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={ElixColors.inkMuted}
                  />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>NEW PASSWORD (MIN. 6 CHARACTERS) *</Text>
              <View style={styles.passwordFieldContainer}>
                <TextInput
                  style={[styles.modalInput, styles.passwordInput]}
                  placeholder="Enter new password"
                  placeholderTextColor={ElixColors.inkMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={ElixColors.inkMuted}
                  />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD *</Text>
              <View style={styles.passwordFieldContainer}>
                <TextInput
                  style={[styles.modalInput, styles.passwordInput]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={ElixColors.inkMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={ElixColors.inkMuted}
                  />
                </Pressable>
              </View>

              <View style={[styles.modalBtnRow, { marginTop: 20 }]}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setShowChangePasswordModal(false)}
                  disabled={isChangingPassword}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalSaveBtn, isChangingPassword && styles.btnDisabled]}
                  onPress={handleSavePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color={ElixColors.white} size="small" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Update Password</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── PASSWORD SUCCESS POPUP MODAL ── */}
      <Modal
        visible={passwordSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordSuccessModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => setPasswordSuccessModal(false)}
          />
          <View style={styles.confirmModalCard}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#059669" />
            </View>
            <Text style={styles.confirmTitle}>Password Updated</Text>
            <Text style={styles.confirmMessage}>
              Your account password has been changed successfully. You can use your new password next time you sign in.
            </Text>
            <View style={styles.confirmBtnRow}>
              <Pressable
                style={[styles.confirmDestructiveBtn, { backgroundColor: ElixColors.blue }]}
                onPress={() => setPasswordSuccessModal(false)}
              >
                <Text style={styles.confirmDestructiveBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── IN-APP REMOVE ADDRESS POPUP MODAL ── */}
      <Modal
        visible={addressToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAddressToDelete(null)}
      >
        <View style={styles.confirmModalOverlay}>
          <Pressable
            style={styles.confirmBackdrop}
            onPress={() => setAddressToDelete(null)}
          />
          <View style={styles.confirmModalCard}>
            <View style={[styles.confirmIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Remove Address</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to remove this saved address from your profile?
            </Text>
            <View style={styles.confirmBtnRow}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setAddressToDelete(null)}
              >
                <Text style={styles.confirmCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmDestructiveBtn}
                onPress={confirmDeleteAddress}
              >
                <Text style={styles.confirmDestructiveBtnText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editProfileBtnText: {
    color: ElixColors.blue,
    fontWeight: '700',
    fontSize: 13,
  },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: ElixColors.ink },
  linkText: { fontSize: 13, color: ElixColors.blue, fontWeight: '600' },
  addressCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...ElixShadows.sm,
  },
  addressIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  addressLabel: { fontSize: 14, fontWeight: '700', color: ElixColors.ink },
  addressText: { fontSize: 13, color: ElixColors.inkMuted, lineHeight: 18 },
  addressActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  addressDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
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
  logoutBtn: { borderColor: ElixColors.borderHairlineMedium },
  versionText: { textAlign: 'center', fontSize: 12, color: ElixColors.inkMuted, marginTop: 20 },

  // Modal styles
  modalOverlay: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: ElixColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...ElixShadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: ElixColors.surface1,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
  },
  typePillActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  typePillTextActive: {
    color: ElixColors.white,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: ElixColors.ink,
    backgroundColor: ElixColors.surface1,
    marginBottom: 14,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  modalTextArea: {
    minHeight: 74,
    paddingTop: 11,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ElixColors.surface1,
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  modalSaveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ElixColors.blue,
    ...ElixShadows.sm,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: ElixColors.white,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: ElixRadii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: ElixColors.ink,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  predictionsList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: ElixRadii.sm,
    marginBottom: 10,
    maxHeight: 150,
    overflow: 'hidden',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  predMainText: { fontSize: 13, fontWeight: '600', color: ElixColors.ink },
  predSubText: { fontSize: 11, color: ElixColors.inkMuted },
  modalMapLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: ElixColors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalLocalityChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
  },
  modalLocalityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  modalLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: ElixRadii.md,
    marginBottom: 12,
  },
  modalLocateBtnText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  modalInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  modalInfoText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  coordsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  coordsText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  profileGpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  profileGpsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // In-app confirm modal styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: ElixColors.white,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    ...ElixShadows.md,
    zIndex: 1,
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ElixColors.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  confirmDestructiveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructiveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Edit Profile Modal Styles
  editModalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  phonePrefixBox: {
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  readOnlyEmailWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readOnlyEmailText: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    fontWeight: '500',
  },
  readOnlySubtext: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  passwordFieldContainer: {
    position: 'relative',
    marginBottom: 12,
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
    marginBottom: 0,
  },
  eyeToggleBtn: {
    position: 'absolute',
    right: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});
