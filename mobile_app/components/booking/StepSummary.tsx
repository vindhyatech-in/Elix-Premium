import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { useCartStore } from '@/store/cartStore';
import { useCheckout } from '@/hooks/useBookings';

const SLOT_LABELS: Record<string, string> = {
  morning: 'Morning (7 AM – 12 PM)',
  afternoon: 'Afternoon (12 PM – 4 PM)',
  evening: 'Evening (4 PM – 8 PM)',
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

  const discountAmt = flow.couponApplied
    ? Math.round(subtotal * (flow.discountPct / 100))
    : 0;
  const finalTotal = totalAmount - discountAmt;

  async function handlePlaceOrder() {
    if (!flow.selectedAddress || !flow.selectedDate) {
      Alert.alert('Missing info', 'Please complete all steps.'); return;
    }

    const cart = items.map((item) => ({
      kind: item.isPackage ? 'package' : 'service',
      id: item.isPackage ? item.packageId : item.variantId,
      qty: item.quantity,
    }));

    const payload = {
      address: {
        label: flow.selectedAddress.label,
        text: flow.selectedAddress.text,
        pincode: flow.selectedAddress.pincode,
        lat: flow.selectedAddress.lat,
        lng: flow.selectedAddress.lng,
      },
      cart,
      date: flow.selectedDate,
      booking_type: flow.bookingType,
      time_slot: flow.bookingType === 'regular' ? flow.timeSlot : '',
      exact_time: flow.bookingType === 'urgent' ? flow.exactTime : null,
      payment_method: flow.paymentMethod,
      coupon_code: flow.couponApplied ? flow.couponCode : '',
    };

    flow.setSubmitting(true);
    try {
      const res = await checkout.mutateAsync(payload);
      const bookingNumber = (res.data as any).booking_number as string;
      flow.setSubmittedBookingNumber(bookingNumber);
      clear();       // wipe cart
      flow.reset();  // wipe flow state
      onClose();
      Alert.alert(
        'Booking Confirmed!',
        `Order #${bookingNumber} placed successfully. We are assigning you an artist now.`,
        [{ text: 'View Bookings', onPress: () => router.push('/(tabs)/bookings') }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Something went wrong. Please try again.';
      Alert.alert('Booking Failed', msg);
    } finally {
      flow.setSubmitting(false);
    }
  }

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
        <SummaryRow label="Address" value={flow.selectedAddress?.label + ' — ' + (flow.selectedAddress?.text ?? '')} />
        <SummaryRow label="Date" value={flow.selectedDate ? formatDate(flow.selectedDate) : '-'} />
        <SummaryRow
          label="Slot"
          value={
            flow.bookingType === 'urgent'
              ? 'Express 50-min — ' + (flow.exactTime ?? '')
              : SLOT_LABELS[flow.timeSlot ?? ''] ?? '-'
          }
        />
        <SummaryRow label="Payment" value={flow.paymentMethod === 'pay_at_home' ? 'Pay at Home (Cash / UPI)' : 'Pay Now (Razorpay)'} />
      </View>

      {/* Price breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Price Breakdown</Text>
        <SummaryRow label="Subtotal" value={'Rs.' + subtotal.toFixed(0)} />
        {discountAmt > 0 && (
          <SummaryRow label={`Coupon (${flow.couponCode} ${flow.discountPct}% off)`} value={'-Rs.' + discountAmt.toFixed(0)} highlight />
        )}
        {urgentFee > 0 && (
          <SummaryRow label="Express Priority Fee" value={'+Rs.99'} />
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Payable</Text>
          <Text style={styles.totalValue}>Rs.{finalTotal.toFixed(0)}</Text>
        </View>
        {flow.bookingType === 'urgent' && (
          <Text style={styles.urgentNote}>Rs.50 rush bonus paid to your artist</Text>
        )}
      </View>

      <Pressable
        style={[styles.placeBtn, flow.bookingType === 'urgent' && styles.placeBtnUrgent, flow.isSubmitting && styles.placeBtnDisabled]}
        onPress={handlePlaceOrder}
        disabled={flow.isSubmitting}
      >
        {flow.isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name={flow.bookingType === 'urgent' ? 'flash' : 'checkmark-circle'} size={18} color="#fff" />
            <Text style={styles.placeBtnText}>
              {flow.bookingType === 'urgent' ? 'Place Express Order' : 'Confirm Booking'}
            </Text>
          </>
        )}
      </Pressable>

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
  placeBtnDisabled: { opacity: 0.7 },
  placeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { fontSize: 11, color: ElixColors.inkMuted, textAlign: 'center', lineHeight: 16 },
});
