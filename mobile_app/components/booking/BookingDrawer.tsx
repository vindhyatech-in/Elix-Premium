import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixShadows, ElixTypography } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StepAddress } from './StepAddress';
import { StepDate } from './StepDate';
import { StepSlot } from './StepSlot';
import { StepPayment } from './StepPayment';
import { StepSummary } from './StepSummary';

interface BookingDrawerProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'cart' | 'checkout';
}

const STEPS = [
  { num: 1, label: 'Address',  icon: 'location-outline' },
  { num: 2, label: 'Date',     icon: 'calendar-outline' },
  { num: 3, label: 'Slot',     icon: 'time-outline' },
  { num: 4, label: 'Payment',  icon: 'card-outline' },
  { num: 5, label: 'Review',   icon: 'checkmark-circle-outline' },
] as const;

export function BookingDrawer({ visible, onClose, initialMode = 'cart' }: BookingDrawerProps) {
  const { step, setStep, nextStep, prevStep, reset, bookingType, setBookingType } = useBookingFlowStore();
  const {
    items,
    totalItems,
    subtotal,
    isUrgent,
    urgentFee,
    totalAmount,
    increment,
    decrement,
    removeItem,
    setUrgent,
    getKey,
  } = useCartStore();
  const { isLoggedIn } = useAuthStore();

  const [drawerMode, setDrawerMode] = useState<'cart' | 'checkout'>('cart');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialMode === 'checkout' && items.length > 0 && isLoggedIn) {
        setDrawerMode('checkout');
      } else {
        setDrawerMode('cart');
      }
      setShowLoginPrompt(false);
    }
  }, [visible, initialMode, items.length, isLoggedIn]);

  function handleClose() {
    reset();
    setShowLoginPrompt(false);
    onClose();
  }

  function handleProceedToBooking() {
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      return;
    }
    // Sync urgent booking type to flow store
    setBookingType(isUrgent ? 'urgent' : 'regular');
    setDrawerMode('checkout');
  }

  if (!visible) return null;

  const isUrgentFlow = bookingType === 'urgent' || isUrgent;
  const accentColor = isUrgentFlow && step >= 3 ? ElixColors.urgentRed : ElixColors.blue;

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* ── CART MODE ────────────────────────────────────────────────────────── */}
        {drawerMode === 'cart' ? (
          <View style={styles.cartContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>My Cart</Text>
                <Text style={styles.headerSub}>
                  {totalItems === 0
                    ? 'No items added'
                    : `${totalItems} ${totalItems === 1 ? 'service' : 'services'} selected`}
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12} accessibilityLabel="Close cart">
                <Ionicons name="close" size={20} color={ElixColors.inkMuted} />
              </Pressable>
            </View>

            {items.length === 0 ? (
              /* Empty Cart State */
              <View style={styles.emptyCartBox}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="bag-handle-outline" size={40} color={ElixColors.blue} />
                </View>
                <Text style={styles.emptyCartTitle}>Your Cart is Empty</Text>
                <Text style={styles.emptyCartDesc}>
                  Looks like you haven't added any beauty treatments or wellness packages yet.
                </Text>
                <Button
                  title="Explore Services"
                  variant="primary"
                  size="md"
                  onPress={() => {
                    handleClose();
                    router.push('/(tabs)/services');
                  }}
                  style={{ marginTop: 20, width: '100%' }}
                />
              </View>
            ) : (
              /* Active Cart Items & Summary */
              <View style={{ flex: 1 }}>
                <ScrollView
                  style={styles.cartScroll}
                  contentContainerStyle={styles.cartScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Items List */}
                  <View style={styles.itemsCard}>
                    {items.map((item, idx) => {
                      const key = item.isPackage
                        ? getKey({ isPackage: true, packageId: item.packageId })
                        : getKey({ isPackage: false, variantId: item.variantId });
                      const isLast = idx === items.length - 1;

                      return (
                        <View key={key} style={[styles.cartLine, !isLast && styles.cartLineBorder]}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={styles.cartLineTitleRow}>
                              {item.isPackage && (
                                <Badge label="PACKAGE" variant="urgent" style={{ marginRight: 6 }} />
                              )}
                              <Text style={styles.cartLineName} numberOfLines={2}>
                                {item.name}
                              </Text>
                            </View>
                            <Text style={styles.cartLineMeta}>₹{item.price} • {item.duration} mins</Text>
                          </View>

                          <View style={styles.cartLineRight}>
                            <View style={styles.stepperWrap}>
                              <Pressable
                                onPress={() => decrement(key)}
                                style={styles.stepperBtn}
                                hitSlop={8}
                                accessibilityLabel="Decrease quantity"
                              >
                                <Ionicons
                                  name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                                  size={14}
                                  color={ElixColors.blue}
                                />
                              </Pressable>
                              <Text style={styles.stepperQty}>{item.quantity}</Text>
                              <Pressable
                                onPress={() => increment(key)}
                                style={styles.stepperBtn}
                                hitSlop={8}
                                accessibilityLabel="Increase quantity"
                              >
                                <Ionicons name="add" size={14} color={ElixColors.blue} />
                              </Pressable>
                            </View>
                            <Text style={styles.cartLineTotal}>₹{item.price * item.quantity}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* 50-Min Express Urgent Salon Toggle */}
                  <Pressable
                    style={[styles.urgentOptionCard, isUrgent && styles.urgentOptionCardActive]}
                    onPress={() => setUrgent(!isUrgent)}
                    accessibilityLabel="Toggle express 50 minute delivery"
                  >
                    <View style={styles.urgentOptionLeft}>
                      <View style={styles.urgentIconWrap}>
                        <Ionicons name="flash" size={16} color={ElixColors.blue} />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.urgentOptionTitle}>50-Minute Doorstep Delivery</Text>
                          <Text style={styles.urgentOptionPrice}>+₹99</Text>
                        </View>
                        <Text style={styles.urgentOptionSub}>
                          Certified beautician arrives at your Indore address in 50 minutes.
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, isUrgent && styles.checkboxActive]}>
                      {isUrgent && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </Pressable>

                  {/* Bill Details */}
                  <View style={styles.billCard}>
                    <Text style={styles.billTitle}>Bill Summary</Text>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Item Total</Text>
                      <Text style={styles.billValue}>₹{subtotal}</Text>
                    </View>
                    {isUrgent ? (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Express Priority Fee</Text>
                        <Text style={styles.billValue}>₹{urgentFee}</Text>
                      </View>
                    ) : null}
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Single-Use Sealed Kit</Text>
                      <Text style={[styles.billValue, { color: ElixColors.greenDeep }]}>FREE</Text>
                    </View>
                    <View style={[styles.billRow, styles.billRowTotal]}>
                      <Text style={styles.billLabelTotal}>To Pay</Text>
                      <Text style={styles.billValueTotal}>₹{totalAmount}</Text>
                    </View>
                  </View>

                  {/* Sign In Required Notice (If Guest Clicks Proceed) */}
                  {showLoginPrompt && !isLoggedIn && (
                    <View style={styles.loginCard}>
                      <View style={styles.loginCardHeader}>
                        <Ionicons name="lock-closed" size={18} color={ElixColors.blue} />
                        <Text style={styles.loginCardTitle}>Sign In Required</Text>
                      </View>
                      <Text style={styles.loginCardText}>
                        Please sign in to proceed with your booking. Your current cart will be saved and merged with your account.
                      </Text>
                      <View style={styles.loginCardActions}>
                        <Button
                          title="Sign In / Register"
                          variant="primary"
                          size="sm"
                          onPress={() => {
                            handleClose();
                            router.push({ pathname: '/auth/login', params: { redirect: 'booking' } });
                          }}
                          style={{ flex: 1 }}
                        />
                        <Button
                          title="Cancel"
                          variant="outline"
                          size="sm"
                          onPress={() => setShowLoginPrompt(false)}
                        />
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Cart Bottom Bar */}
                <View style={styles.cartFooter}>
                  <View>
                    <Text style={styles.cartFooterSub}>Total Amount</Text>
                    <Text style={styles.cartFooterTotal}>₹{totalAmount}</Text>
                  </View>
                  <Button
                    title="Proceed to Booking →"
                    variant="primary"
                    size="md"
                    onPress={handleProceedToBooking}
                    style={{ flex: 1, marginLeft: 20 }}
                  />
                </View>
              </View>
            )}
          </View>
        ) : (
          /* ── CHECKOUT MODE (Steps 1 to 5) ────────────────────────────────────────── */
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Book a Session</Text>
                <Text style={styles.headerSub}>Step {step} of 5 — {STEPS[step - 1].label}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12} accessibilityLabel="Close booking">
                <Ionicons name="close" size={20} color={ElixColors.inkMuted} />
              </Pressable>
            </View>

            {/* Step progress dots */}
            <View style={styles.stepDots}>
              {STEPS.map((s) => (
                <Pressable key={s.num} onPress={() => s.num < step && setStep(s.num as any)} style={styles.dotWrap}>
                  <View style={[
                    styles.dot,
                    s.num === step && [styles.dotActive, { backgroundColor: accentColor }],
                    s.num < step && [styles.dotDone, { backgroundColor: accentColor + '33', borderColor: accentColor }],
                  ]}>
                    {s.num < step ? (
                      <Ionicons name="checkmark" size={10} color={accentColor} />
                    ) : (
                      <Text style={[styles.dotNum, s.num === step && { color: '#fff' }]}>{s.num}</Text>
                    )}
                  </View>
                  {s.num < STEPS.length && (
                    <View style={[styles.dotLine, s.num < step && { backgroundColor: accentColor }]} />
                  )}
                </Pressable>
              ))}
            </View>

            {/* Step content */}
            <View style={styles.content}>
              {step === 1 && <StepAddress onNext={nextStep} />}
              {step === 2 && <StepDate onNext={nextStep} />}
              {step === 3 && <StepSlot onNext={nextStep} />}
              {step === 4 && <StepPayment onNext={nextStep} />}
              {step === 5 && <StepSummary onClose={handleClose} />}
            </View>

            {/* Bottom Nav / Back Bar */}
            <View style={styles.checkoutFooter}>
              {step === 1 ? (
                <Pressable
                  style={styles.reviewCartBtn}
                  onPress={() => setDrawerMode('cart')}
                  hitSlop={8}
                >
                  <Ionicons name="cart-outline" size={16} color={ElixColors.blue} />
                  <Text style={styles.reviewCartText}>Review Cart ({totalItems})</Text>
                </Pressable>
              ) : step < 5 ? (
                <Pressable style={styles.backBtn} onPress={prevStep} hitSlop={8}>
                  <Ionicons name="arrow-back" size={16} color={ElixColors.inkMuted} />
                  <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    overflow: 'hidden',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: ElixColors.ink },
  headerSub: { fontSize: 13, color: ElixColors.inkMuted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  cartContainer: {
    flex: 1,
  },
  cartScroll: {
    flex: 1,
  },
  cartScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  emptyCartBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ElixColors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCartTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: ElixColors.ink,
    marginBottom: 8,
  },
  emptyCartDesc: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  itemsCard: {
    backgroundColor: ElixColors.surface2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  cartLineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: ElixColors.borderHairline,
  },
  cartLineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartLineName: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
    flexShrink: 1,
  },
  cartLineMeta: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    marginTop: 4,
  },
  cartLineRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  stepperQty: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
    minWidth: 20,
    textAlign: 'center',
  },
  cartLineTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  urgentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ElixColors.surface2,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ElixColors.borderHairline,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  urgentOptionCardActive: {
    borderColor: ElixColors.blue,
    backgroundColor: ElixColors.blueLight,
  },
  urgentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  urgentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ElixColors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  urgentOptionPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: ElixColors.blue,
  },
  urgentOptionSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: ElixColors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  billCard: {
    backgroundColor: ElixColors.surface2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: ElixColors.ink,
    marginBottom: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  billLabel: {
    fontSize: 13,
    color: ElixColors.inkMuted,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  billRowTotal: {
    borderTopWidth: 1,
    borderTopColor: ElixColors.borderHairline,
    marginTop: 8,
    paddingTop: 10,
  },
  billLabelTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  billValueTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: ElixColors.blue,
  },
  loginCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
  },
  loginCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  loginCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: ElixColors.blue,
  },
  loginCardText: {
    fontSize: 12,
    color: ElixColors.ink,
    lineHeight: 18,
    marginBottom: 12,
  },
  loginCardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: ElixColors.surface2,
    borderTopWidth: 1,
    borderTopColor: ElixColors.borderHairline,
  },
  cartFooterSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    fontWeight: '600',
  },
  cartFooterTotal: {
    fontSize: 20,
    fontWeight: '900',
    color: ElixColors.ink,
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 2,
  },
  dotWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dotActive: { backgroundColor: ElixColors.blue, borderColor: 'transparent' },
  dotDone: {},
  dotNum: { fontSize: 10, fontWeight: '700', color: ElixColors.inkMuted },
  dotLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 2 },
  content: { flex: 1, paddingTop: 4 },
  checkoutFooter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  reviewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  reviewCartText: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.blue,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  backBtnText: { fontSize: 13, fontWeight: '600', color: ElixColors.inkMuted },
});
