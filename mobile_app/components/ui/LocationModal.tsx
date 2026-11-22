import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useLocationStore } from '@/store/locationStore';
import { useAuthStore } from '@/store/authStore';
import { useAddresses } from '@/hooks/useProfile';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import {
  getCurrentCoordinates,
  reverseGeocodeGoogle,
  POPULAR_INDORE_LOCALITIES,
} from '@/lib/googleMaps';

interface LocationModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LocationModal({ visible, onClose }: LocationModalProps) {
  const { selectedLocation, setSelectedLocation } = useLocationStore();
  const { isLoggedIn } = useAuthStore();
  const { data: addresses } = useAddresses(isLoggedIn);
  const setBookingAddress = useBookingFlowStore((s) => s.setAddress);

  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleDetectLocation() {
    setErrorMsg('');
    setLocating(true);
    try {
      const pos = await getCurrentCoordinates();
      const res = await reverseGeocodeGoogle(pos.lat, pos.lng);
      if (res.ok) {
        const areaName = res.locality || (res.address ? res.address.split(',')[0] : '') || 'Indore';
        const display = `${areaName}, Indore`;
        setSelectedLocation(display);
        onClose();
      } else {
        setSelectedLocation('Indore, MP');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not detect GPS location.');
    } finally {
      setLocating(false);
    }
  }

  function handleSelectLocality(name: string) {
    setSelectedLocation(`${name}, Indore`);
    onClose();
  }

  function handleSelectAddress(addr: any) {
    const summary = addr.label ? `${addr.label} — ${addr.text.split(',')[0]}` : addr.text;
    setSelectedLocation(summary);
    setBookingAddress(addr);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location-sharp" size={20} color={ElixColors.blue} />
              <Text style={styles.headerTitle}>Select Location</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={ElixColors.inkMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* Active City Card */}
            <View style={styles.cityCard}>
              <View style={styles.cityBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.cityBadgeText}>SERVICE AREA</Text>
              </View>
              <Text style={styles.cityName}>Indore, Madhya Pradesh</Text>
              <Text style={styles.citySub}>
                50-minute express and scheduled doorstep salon services available across all Indore areas.
              </Text>
            </View>

            {/* GPS Detection Button */}
            <Pressable
              style={[styles.locateBtn, locating && { opacity: 0.7 }]}
              onPress={handleDetectLocation}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <Ionicons name="navigate-circle" size={20} color="#1D4ED8" />
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.locateBtnTitle}>
                  {locating ? 'Detecting current area…' : 'Use Current Location'}
                </Text>
                <Text style={styles.locateBtnSub}>Enable device GPS for doorstep pin</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#1D4ED8" />
            </Pressable>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Saved Addresses (if logged in and has addresses) */}
            {isLoggedIn && addresses && addresses.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Saved Addresses</Text>
                  <Pressable onPress={() => { onClose(); router.push('/(tabs)/profile'); }}>
                    <Text style={styles.manageText}>Manage</Text>
                  </Pressable>
                </View>
                {addresses.map((addr) => {
                  const isCurrent = selectedLocation.includes(addr.label) || selectedLocation.includes(addr.text.split(',')[0]);
                  return (
                    <Pressable
                      key={addr.id}
                      style={[styles.addressItem, isCurrent && styles.addressItemActive]}
                      onPress={() => handleSelectAddress(addr)}
                    >
                      <Ionicons
                        name={addr.label?.toLowerCase().includes('work') ? 'briefcase-outline' : 'home-outline'}
                        size={16}
                        color={isCurrent ? ElixColors.blue : ElixColors.inkMuted}
                      />
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={[styles.addrLabel, isCurrent && { color: ElixColors.blue }]}>{addr.label}</Text>
                        <Text style={styles.addrText} numberOfLines={1}>{addr.text}</Text>
                      </View>
                      {isCurrent && <Ionicons name="checkmark-circle" size={18} color={ElixColors.blue} />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Popular Indore Localities */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Areas in Indore</Text>
              <View style={styles.chipsWrap}>
                {POPULAR_INDORE_LOCALITIES.map((loc) => {
                  const isSelected = selectedLocation.toLowerCase().includes(loc.name.toLowerCase());
                  return (
                    <Pressable
                      key={loc.name}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => handleSelectLocality(loc.name)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {loc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 28 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: ElixColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '80%',
    ...ElixShadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: 14,
  },
  cityCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: ElixRadii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 12,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  cityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  cityName: {
    fontSize: 15,
    fontWeight: '700',
    color: ElixColors.ink,
    marginBottom: 2,
  },
  citySub: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    lineHeight: 16,
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: ElixRadii.md,
    padding: 14,
    marginBottom: 14,
  },
  locateBtnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  locateBtnSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 10,
  },
  section: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  manageText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.blue,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: ElixRadii.sm,
    padding: 10,
    marginBottom: 6,
  },
  addressItemActive: {
    borderColor: ElixColors.blue,
    backgroundColor: '#EFF6FF',
  },
  addrLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  addrText: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
