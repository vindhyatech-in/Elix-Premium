import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { apiClient } from '@/lib/apiClient';
import type { PaymentMethod } from '@/store/bookingFlowStore';

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; sub: string; icon: string }[] = [
  { key: 'pay_at_home', label: 'Pay at Home',  sub: 'Cash / UPI when artist arrives',  icon: 'cash-outline' },
  { key: 'pay_now',     label: 'Pay Now',       sub: 'Secure online via Razorpay (UPI, Cards)',        icon: 'card-outline' },
];

export function StepPayment({ onNext }: { onNext: () => void }) {
  const {
    paymentMethod, setPaymentMethod,
    couponCode, couponApplied, discountPct,
    setCoupon, clearCoupon,
  } = useBookingFlowStore();

  const [couponInput, setCouponInput] = useState(couponCode);
  const [validating, setValidating] = useState(false);
  const [couponError, setCouponError] = useState('');

  async function handleValidateCoupon() {
    setCouponError('');
    if (!couponInput.trim()) { setCouponError('Enter a coupon code.'); return; }
    setValidating(true);
    try {
      const res = await apiClient.post('/validate-coupon/', { code: couponInput.trim().toUpperCase() });
      const data = res.data as { valid: boolean; code?: string; discount_pct?: number; message?: string };
      if (data.valid && data.discount_pct) {
        setCoupon(data.code!, data.discount_pct);
      } else {
        setCouponError(data.message ?? 'Invalid coupon.');
        clearCoupon();
      }
    } catch {
      setCouponError('Could not validate. Try again.');
    } finally { setValidating(false); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>How would you like to pay?</Text>
      <Text style={styles.stepSubtitle}>Choose your preferred payment method</Text>

      {/* Payment options */}
      {PAYMENT_OPTIONS.map((opt) => {
        const active = paymentMethod === opt.key;
        const comingSoon = opt.key === 'pay_now';
        return (
          <Pressable
            key={opt.key}
            style={[styles.optCard, active && styles.optCardActive, comingSoon && styles.optCardDimmed]}
            onPress={() => !comingSoon && setPaymentMethod(opt.key)}
          >
            <View style={[styles.optIcon, active && { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name={opt.icon as any} size={22} color={active ? ElixColors.blue : ElixColors.inkMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.optLabelRow}>
                <Text style={[styles.optLabel, active && { color: ElixColors.blue }]}>{opt.label}</Text>
                {comingSoon && (
                  <View style={styles.soonBadge}><Text style={styles.soonBadgeText}>Coming Soon</Text></View>
                )}
              </View>
              <Text style={styles.optSub}>{opt.sub}</Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>
              {active && <View style={styles.radioInner} />}
            </View>
          </Pressable>
        );
      })}

      {/* Coupon section */}
      <View style={styles.couponSection}>
        <Text style={styles.couponTitle}>Have a coupon code?</Text>
        <View style={styles.couponRow}>
          <TextInput
            style={[styles.couponInput, couponApplied && styles.couponInputApplied]}
            value={couponInput}
            onChangeText={(v) => { setCouponInput(v.toUpperCase()); if (couponApplied) clearCoupon(); }}
            placeholder="e.g. ELIX20"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            editable={!couponApplied}
          />
          {couponApplied ? (
            <Pressable style={styles.couponRemoveBtn} onPress={() => { clearCoupon(); setCouponInput(''); }}>
              <Ionicons name="close-circle" size={18} color="#DC2626" />
              <Text style={styles.couponRemoveText}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.couponApplyBtn} onPress={handleValidateCoupon} disabled={validating}>
              {validating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.couponApplyText}>Apply</Text>}
            </Pressable>
          )}
        </View>
        {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
        {couponApplied && (
          <View style={styles.couponSuccess}>
            <Ionicons name="checkmark-circle" size={14} color={ElixColors.green} />
            <Text style={styles.couponSuccessText}>Coupon applied! {discountPct}% off</Text>
          </View>
        )}
      </View>

      <Pressable style={styles.nextBtn} onPress={onNext}>
        <Text style={styles.nextBtnText}>Review Order</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: ElixColors.inkMuted, marginBottom: 16 },
  optCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: ElixRadii.lg, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', marginBottom: 10 },
  optCardActive: { borderColor: ElixColors.blue, backgroundColor: '#EFF6FF' },
  optCardDimmed: { opacity: 0.55 },
  optIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  optLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  optLabel: { fontSize: 15, fontWeight: '700', color: ElixColors.ink },
  soonBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  soonBadgeText: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  optSub: { fontSize: 12, color: ElixColors.inkMuted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: ElixColors.blue },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: ElixColors.blue },
  couponSection: { marginTop: 8, marginBottom: 16 },
  couponTitle: { fontSize: 14, fontWeight: '700', color: ElixColors.ink, marginBottom: 8 },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  couponInput: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: ElixRadii.md, padding: 10, fontSize: 14, fontWeight: '700', color: ElixColors.ink, letterSpacing: 1, backgroundColor: '#fff' },
  couponInputApplied: { borderColor: ElixColors.green, backgroundColor: '#F0FDF4' },
  couponApplyBtn: { backgroundColor: ElixColors.blue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: ElixRadii.md, minWidth: 70, alignItems: 'center' },
  couponApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  couponRemoveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: ElixRadii.md, borderWidth: 1.5, borderColor: '#FECACA' },
  couponRemoveText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  couponError: { fontSize: 12, color: '#DC2626', marginTop: 6 },
  couponSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  couponSuccessText: { fontSize: 12, color: ElixColors.green, fontWeight: '600' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ElixColors.blue, borderRadius: ElixRadii.lg, paddingVertical: 14, marginTop: 4, marginBottom: 8 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
