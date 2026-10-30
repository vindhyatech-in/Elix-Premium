import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCartStore } from '@/store/cartStore';

const TOP_EXPRESS_SERVICES = [
  { id: 'u1', name: 'Express Glow Cleanup', duration: '35 mins', price: 599 },
  { id: 'u2', name: 'Eyebrows + Upper Lip Threading', duration: '20 mins', price: 99 },
  { id: 'u3', name: 'Instant Hair Styling / Blowdry', duration: '30 mins', price: 499 },
  { id: 'u4', name: 'Quick Detan Face Pack', duration: '25 mins', price: 399 },
];

export default function UrgentScreen() {
  const { totalItems } = useCartStore();
  const [selectedSlot, setSelectedSlot] = useState('Earliest: In 50 mins');

  // Compute live slots starting 50 mins from now
  const now = new Date();
  const slot1Time = new Date(now.getTime() + 50 * 60000);
  const slot2Time = new Date(now.getTime() + 65 * 60000);
  const slot3Time = new Date(now.getTime() + 80 * 60000);

  const formatTime = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
  };

  const EXPRESS_SLOTS = [
    `Today, ${formatTime(slot1Time)} (Earliest)`,
    `Today, ${formatTime(slot2Time)}`,
    `Today, ${formatTime(slot3Time)}`,
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        location="Indore, MP"
        cartItemCount={totalItems}
        onSearchPress={() => router.push({ pathname: '/(tabs)/services', params: { autoSearch: '1' } })}
        onCartPress={() => router.push({ pathname: '/(tabs)/services', params: { openCart: '1' } })}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. Urgency Header */}
        <View style={styles.urgentBanner}>
          <View style={styles.bannerBadgeRow}>
            <Badge label="⚡ PRIORITY DISPATCH" variant="category" />
            <Text style={styles.feeHighlight}>+₹99 Express Fee</Text>
          </View>
          <Text style={styles.bannerTitle}>50-Minute Express Urgent Salon</Text>
          <Text style={styles.bannerDesc}>
            Got an unexpected party, wedding, or urgent meeting? We dispatch a dedicated certified beautician to your door in Indore within 50 minutes.
          </Text>

          {/* Guarantee Pill */}
          <View style={styles.guaranteeBox}>
            <Ionicons name="flash" size={16} color={ElixColors.blue} />
            <Text style={styles.guaranteeText}>
              Earliest arrival window: <Text style={{ fontWeight: 'bold' }}>{formatTime(slot1Time)}</Text>
            </Text>
          </View>
        </View>

        {/* 2. Select Express Slot */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Express Time Window</Text>
          <View style={styles.slotsRow}>
            {EXPRESS_SLOTS.map((slot, idx) => {
              const isSelected = selectedSlot === slot;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedSlot(slot)}
                  style={[styles.slotCard, isSelected && styles.slotCardActive]}>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={isSelected ? ElixColors.blue : ElixColors.inkMuted}
                  />
                  <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. Top Express Services (Quick-Add) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular 1-Tap Urgent Services</Text>
          {TOP_EXPRESS_SERVICES.map((item) => (
            <View key={item.id} style={styles.expressItemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expressItemName}>{item.name}</Text>
                <Text style={styles.expressItemMeta}>⏱ {item.duration} · ₹{item.price}</Text>
              </View>
              <Button
                title="+ Add"
                size="sm"
                variant="primary"
                onPress={() => {}}
                style={{ paddingHorizontal: 16 }}
              />
            </View>
          ))}
        </View>

        {/* 4. Pricing Transparency Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>How Express Pricing Works:</Text>
          <Text style={styles.noticeText}>
            • Regular booking prices remain standard.{'\n'}
            • A flat ₹99 priority dispatch surcharge is applied at checkout.{'\n'}
            • ₹50 is directly rewarded as a rush allowance to your beautician for immediate travel.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ElixColors.surface1,
  },
  container: {
    flex: 1,
  },
  urgentBanner: {
    backgroundColor: ElixColors.blueLight,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: ElixRadii.xl,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeHighlight: {
    backgroundColor: ElixColors.blue,
    color: ElixColors.white,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: ElixRadii.pill,
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
  },
  bannerTitle: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 12,
    color: ElixColors.inkSoft,
    lineHeight: 18,
    marginBottom: 14,
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: ElixRadii.pill,
    gap: 6,
  },
  guaranteeText: {
    fontSize: 12,
    color: ElixColors.ink,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 12,
  },
  slotsRow: {
    gap: 8,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface2,
    padding: 12,
    borderRadius: ElixRadii.md,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    gap: 10,
  },
  slotCardActive: {
    backgroundColor: ElixColors.blueLight,
    borderColor: ElixColors.blue,
  },
  slotText: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.ink,
  },
  slotTextActive: {
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
  },
  expressItemCard: {
    backgroundColor: ElixColors.surface2,
    borderRadius: ElixRadii.lg,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  expressItemName: {
    fontSize: ElixTypography.sizes.sm,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  expressItemMeta: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  noticeBox: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: ElixColors.surface2,
    borderRadius: ElixRadii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    lineHeight: 18,
  },
});
