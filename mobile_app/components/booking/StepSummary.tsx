import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { useCartStore } from '@/store/cartStore';
import { useCheckout } from '@/hooks/useBookings';
import { useRazorpayOrder, useRazorpayVerify } from '@/hooks/useRazorpay';
import { apiClient } from '@/lib/apiClient';

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning (7 AM - 12 PM)',
  afternoon: 'Afternoon (12 PM - 4 PM)',
  evening: 'Evening (4 PM - 8 PM)',
};

function formatDate(ymd: string) {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]}>{value}</Text>
    </View>
  );
}

export function StepSummary({ onClose }: { onClose: () => void }) {
  const flow = useBookingFlowStore();
  const { items, subtotal, urgentFee, totalAmount, clear } = useCartStore();
  const checkout = useCheckout();
  const createRazorpayOrder = useRazorpayOrder();
  const verifyRazorpay = useRazorpayVerify();

  const discountAmt = flow.couponApplied
    ? Math.round(subtotal * (flow.discountPct / 100))
    : 0;
  const finalTotal = totalAmount - discountAmt;
  const finalPaise = Math.round(finalTotal * 100);

  function buildBookingPayload(extra: Record<string, unknown> = {}) {
    return {
      address: {
        label: flow.selectedAddress?.label,
        text: flow.selectedAddress?.text,
        pincode: flow.selectedAddress?.pincode,
        lat: flow.selectedAddress?.lat,
        lng: flow.selectedAddress?.lng,
      },
      cart: items.map((item) => ({
        kind: item.isPackage ? 'package' : 'service',
        id: item.isPackage ? item.packageId : item.variantId,
        qty: item.quantity,
      })),
      date: flow.selectedDate,
      booking_type: flow.bookingType,
      time_slot: flow.bookingType === 'regular' ? flow.timeSlot : '',
      exact_time: flow.bookingType === 'urgent' ? flow.exactTime : null,
      coupon_code: flow.couponApplied ? flow.couponCode : '',
      ...extra,
    };
  }

  function afterSuccess(bookingNumber: string, paymentMethod: string) {
    clear();
    flow.reset();
    onClose();
    router.replace({
      pathname: '/booking-confirmed' as any,
      params: { booking_number: bookingNumber, payment_method: paymentMethod },
    });
  }

  // ── Pay at Home ─────────────────────────────────────────────────────────────
  async function handlePayAtHome() {
    if (!flow.selectedAddress || !flow.selectedDate) {
      Alert.alert('Missing info', 'Please complete all steps.'); return;
    }
    flow.setSubmitting(true);
    try {
      const res = await checkout.mutateAsync(buildBookingPayload({ payment_method: 'pay_at_home' }));
      const bookingNumber = (res.data as any).booking_number as string;
      afterSuccess(bookingNumber, 'pay_at_home');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Something went wrong. Please try again.';
      Alert.alert('Booking Failed', msg);
    } finally {
      flow.setSubmitting(false);
    }
  }

  // ── Razorpay (Pay Now) ───────────────────────────────────────────────────────
  async function handlePayNow() {
    if (!flow.selectedAddress || !flow.selectedDate) {
      Alert.alert('Missing info', 'Please complete all steps.'); return;
    }
    flow.setSubmitting(true);
    try {
      // Step 1: create Razorpay order on backend
      const orderRes = await createRazorpayOrder.mutateAsync({
        amount_paise: finalPaise,
        receipt: `cart_${Date.now()}`,
      });
      const { order_id, amount, currency, key_id } = (orderRes.data as any);

      // Step 2: open Razorpay checkout
      // On web: use Razorpay's hosted checkout page in a WebBrowser
      // On native: use react-native-razorpay SDK (installed separately for bare workflow)
      if (Platform.OS === 'web') {
        await handleRazorpayWeb(order_id, amount, key_id);
      } else {
        await handleRazorpayNative(order_id, amount, key_id);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Payment failed. Please try again.';
      Alert.alert('Payment Error', msg);
      flow.setSubmitting(false);
    }
  }

  async function handleRazorpayWeb(orderId: string, amount: number, keyId: string) {
    // Razorpay hosted checkout URL for web testing
    const returnUrl = 'http://localhost:8003/api/v1/payments/razorpay/web-callback/';
    const url = `https://api.razorpay.com/v1/checkout/embedded?key_id=${keyId}&order_id=${orderId}&amount=${amount}&currency=INR&name=Elix&description=Beauty+Session&callback_url=${encodeURIComponent(returnUrl)}`;
    Alert.alert(
      'Web Payment Testing',
      'Razorpay native SDK works on iOS/Android devices.\n\nFor web browser testing, use "Pay at Home" or test on an Android emulator.',
      [
        { text: 'Use Pay at Home', onPress: handlePayAtHome },
        { text: 'Cancel', style: 'cancel', onPress: () => flow.setSubmitting(false) },
      ]
    );
  }

  async function handleRazorpayNative(orderId: string, amount: number, keyId: string) {
    // Dynamically import react-native-razorpay (only available in bare/dev-client builds)
    try {
      const RazorpayCheckout = require('react-native-razorpay').default;
      const options = {
        key: keyId,
        amount: String(amount),
        currency: 'INR',
        order_id: orderId,
        name: 'Elix',
        description: 'Beauty Session',
        prefill: {},
        theme: { color: '#4F46E5' },
      };
      const paymentData = await RazorpayCheckout.open(options);
      // Step 3: verify + create booking
      const verifyPayload = {
        ...buildBookingPayload({ payment_method: 'pay_now' }),
        razorpay_order_id:   paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature:  paymentData.razorpay_signature,
      };
      const verifyRes = await verifyRazorpay.mutateAsync(verifyPayload);
      const bookingNumber = (verifyRes.data as any).booking_number as string;
      afterSuccess(bookingNumber, 'razorpay');
    } catch (err: any) {
      if (err?.code === 'PAYMENT_CANCELLED') {
        Alert.alert('Payment Cancelled', 'Your payment was cancelled. No charges were made.');
      } else if (err?.message?.includes('Cannot find module')) {
        // Module not installed in Expo Go — guide user
        Alert.alert(
          'Native SDK Required',
          'Razorpay payments require a development build. Use "Pay at Home" for testing with Expo Go.',
          [{ text: 'Use Pay at Home', onPress: handlePayAtHome }, { text: 'Cancel', style: 'cancel' }]
        );
      } else {
        Alert.alert('Payment Error', err?.description ?? 'Payment failed. Please try again.');
      }
      flow.setSubmitting(false);
    }
  }

  const isUrgent = flow.bookingType === 'urgent';
  const isPayNow = flow.paymentMethod === 'pay_now';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Review Your Order</Text>
      <Text style={styles.stepSubtitle}>Confirm everything looks right before placing</Text>

      {/* Services booked */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Services</Text>
        {items.map((item, i) => (
          <View key={i} style={[styles.itemRow, i < items.length - 1 && styles.itemRowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDuration}>{item.duration} mins</Text>
            </View>
            <Text style={styles.itemPrice}>Rs.{(item.price * item.quantity).toFixed(0)}</Text>
            {item.quantity > 1 && <Text style={styles.itemQty}>x{item.quantity}</Text>}
          </View>
        ))}
      </View>

      {/* Booking details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Details</Text>
        <SummaryRow
          label="Address"
          value={(flow.selectedAddress?.label ?? '') + ' — ' + (flow.selectedAddress?.text ?? '')}
        />
        <SummaryRow
          label="Date"
          value={flow.selectedDate ? formatDate(flow.selectedDate) : '-'}
        />
        <SummaryRow
          label="Slot"
          value={
            isUrgent
              ? 'Express 50-min — ' + (flow.exactTime ?? '')
              : SLOT_LABELS[flow.timeSlot ?? ''] ?? '-'
          }
        />
        <SummaryRow
          label="Payment"
          value={isPayNow ? 'Pay Now (Razorpay)' : 'Pay at Home (Cash / UPI)'}
        />
      </View>

      {/* Price breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Price Breakdown</Text>
        <SummaryRow label="Subtotal" value={'Rs.' + subtotal.toFixed(0)} />
        {discountAmt > 0 && (
          <SummaryRow
            label={flow.couponCode + ' (' + flow.discountPct + '% off)'}
            value={'-Rs.' + discountAmt.toFixed(0)}
            highlight
          />
        )}
        {urgentFee > 0 && (
          <SummaryRow label="Express Priority Fee" value="+Rs.99" />
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Payable</Text>
          <Text style={styles.totalValue}>Rs.{finalTotal.toFixed(0)}</Text>
        </View>
        {isUrgent && (
          <Text style={styles.urgentNote}>Rs.50 rush bonus paid to your artist</Text>
        )}
      </View>

      {/* Place order button — dual path */}
      {isPayNow ? (
        <Pressable
          style={[styles.placeBtn, styles.placeBtnPayNow, flow.isSubmitting && styles.placeBtnDisabled]}
          onPress={handlePayNow}
          disabled={flow.isSubmitting}
        >
          {flow.isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="card" size={18} color="#fff" />
              <Text style={styles.placeBtnText}>Pay Rs.{finalTotal.toFixed(0)} Now</Text>
            </>
          )}
        </Pressable>
      ) : (
        <Pressable
          style={[styles.placeBtn, isUrgent && styles.placeBtnUrgent, flow.isSubmitting && styles.placeBtnDisabled]}
          onPress={handlePayAtHome}
          disabled={flow.isSubmitting}
        >
          {flow.isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name={isUrgent ? 'flash' : 'checkmark-circle'} size={18} color="#fff" />
              <Text style={styles.placeBtnText}>
                {isUrgent ? 'Place Express Order' : 'Confirm Booking'}
              </Text>
            </>
          )}
        </Pressable>
      )}

      <Text style={styles.disclaimer}>
        By placing this order you agree to our terms. Cancellations are free until the artist is assigned.
      </Text>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: ElixColors.inkMuted, marginBottom: 16 },
  card: { backgroundColor: ElixColors.white, borderRadius: ElixRadii.lg, padding: 16, marginBottom: 12, ...ElixShadows.sm },
  cardTitle: { fontSize: 13, fontWeight: '700', color: ElixColors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemName: { fontSize: 14, fontWeight: '600', color: ElixColors.ink },
  itemDuration: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: ElixColors.ink, marginLeft: 8 },
  itemQty: { fontSize: 12, color: ElixColors.inkMuted, marginLeft: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  summaryLabel: { fontSize: 13, color: ElixColors.inkMuted, flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: '600', color: ElixColors.ink, flex: 1, textAlign: 'right' },
  summaryValueHighlight: { color: ElixColors.green },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 4, borderTopWidth: 1.5, borderTopColor: '#E5E7EB' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: ElixColors.ink },
  totalValue: { fontSize: 20, fontWeight: '800', color: ElixColors.ink },
  urgentNote: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 6, textAlign: 'center', fontStyle: 'italic' },
  placeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ElixColors.blue, borderRadius: ElixRadii.lg, paddingVertical: 16, marginTop: 4, marginBottom: 10 },
  placeBtnUrgent: { backgroundColor: ElixColors.urgentRed },
  placeBtnPayNow: { backgroundColor: '#059669' },
  placeBtnDisabled: { opacity: 0.7 },
  placeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 11, color: ElixColors.inkMuted, textAlign: 'center', lineHeight: 16 },
});
