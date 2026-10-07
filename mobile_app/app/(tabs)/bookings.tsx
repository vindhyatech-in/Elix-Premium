import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/store/authStore';
import { useBookings, useCancelBooking } from '@/hooks/useBookings';
import type { Booking } from '@/types/api';

type FilterTab = 'all' | 'upcoming' | 'completed' | 'cancelled';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: '#FEF3C7', text: '#92400E', label: 'Pending' },
  confirmed:   { bg: '#D1FAE5', text: '#065F46', label: 'Confirmed' },
  assigned:    { bg: '#DBEAFE', text: '#1E40AF', label: 'Artist Assigned' },
  on_the_way:  { bg: '#EDE9FE', text: '#5B21B6', label: 'On the Way' },
  in_progress: { bg: '#FEF3C7', text: '#92400E', label: 'In Progress' },
  completed:   { bg: '#D1FAE5', text: '#065F46', label: 'Completed' },
  cancelled:   { bg: '#FEE2E2', text: '#991B1B', label: 'Cancelled' },
};

const UPCOMING_STATUSES = ['pending', 'confirmed', 'assigned', 'on_the_way', 'in_progress'];

function BookingCard({ booking, onCancel }: { booking: Booking; onCancel: (num: string) => void }) {
  const statusInfo = STATUS_COLORS[booking.status] ?? { bg: '#F3F4F6', text: '#374151', label: booking.status_display };

  return (
    <View style={styles.bookingCard}>
      {/* Header row */}
      <View style={styles.bookingCardHeader}>
        <View>
          <Text style={styles.bookingNum}>#{booking.booking_number}</Text>
          <Text style={styles.bookingDate}>{new Date(booking.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
        <View style={styles.badgeRow}>
          {booking.booking_type === 'urgent' && (
            <View style={styles.urgentPill}>
              <Text style={styles.urgentPillText}>URGENT</Text>
            </View>
          )}
          <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusPillText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>
      </View>

      {/* Time */}
      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={14} color={ElixColors.inkMuted} />
        <Text style={styles.timeText}>
          {booking.booking_type === 'urgent'
            ? (booking.exact_time ? booking.exact_time + ' (Express 50-min)' : 'Express 50-min')
            : (booking.time_slot_display ?? booking.time_slot ?? 'TBD')}
        </Text>
      </View>

      {/* Items */}
      <View style={styles.itemsList}>
        {booking.items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}{item.quantity > 1 ? ` x${item.quantity}` : ''}</Text>
            <Text style={styles.itemPrice}>Rs.{(item.price * item.quantity).toFixed(0)}</Text>
          </View>
        ))}
      </View>

      {/* Pricing */}
      <View style={styles.pricingSection}>
        {booking.discount_amount > 0 && (
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Discount</Text>
            <Text style={[styles.pricingValue, { color: ElixColors.green }]}>-Rs.{booking.discount_amount.toFixed(0)}</Text>
          </View>
        )}
        {booking.booking_type === 'urgent' && (
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Priority Fee</Text>
            <Text style={[styles.pricingValue, { color: '#C2185B' }]}>+Rs.99</Text>
          </View>
        )}
        <View style={[styles.pricingRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs.{booking.total_amount.toFixed(0)}</Text>
        </View>
      </View>

      {/* Address */}
      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={14} color={ElixColors.inkMuted} />
        <Text style={styles.addressText} numberOfLines={1}>{booking.address_label}: {booking.address_text}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <Pressable style={styles.actionBtn}>
          <Ionicons name="receipt-outline" size={14} color={ElixColors.blue} />
          <Text style={styles.actionBtnText}>Invoice</Text>
        </Pressable>
        {booking.status === 'on_the_way' && (
          <Pressable style={styles.actionBtn}>
            <Ionicons name="location-outline" size={14} color={ElixColors.blue} />
            <Text style={styles.actionBtnText}>Track</Text>
          </Pressable>
        )}
        {booking.can_cancel && (
          <Pressable
            style={[styles.actionBtn, { borderColor: '#FCA5A5' }]}
            onPress={() => onCancel(booking.booking_number)}
          >
            <Ionicons name="close-outline" size={14} color="#DC2626" />
            <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { isLoggedIn } = useAuthStore();
  const { data: bookings, isLoading, error } = useBookings(isLoggedIn);
  const cancelBooking = useCancelBooking();

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const filtered = (bookings ?? []).filter((b) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') return UPCOMING_STATUSES.includes(b.status);
    return b.status === activeFilter;
  });

  function handleCancel(bookingNumber: string) {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep Booking', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: () => cancelBooking.mutate(bookingNumber),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header location="Indore, MP" />

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {filters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {!isLoggedIn ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={48} color={ElixColors.inkMuted} />
            <Text style={styles.emptyTitle}>Sign in to see your bookings</Text>
            <Pressable style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={ElixColors.blue} style={{ marginTop: 60 }} size="large" />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={ElixColors.inkMuted} />
            <Text style={styles.emptyTitle}>No bookings found</Text>
            <Text style={styles.emptySubtitle}>Your bookings will appear here once you place an order.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filtered.map((b) => (
              <BookingCard key={b.booking_number} booking={b} onCancel={handleCancel} />
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ElixColors.surface1 },
  filterBar: { maxHeight: 52, backgroundColor: ElixColors.white, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: { backgroundColor: ElixColors.blue },
  filterTabText: { fontSize: 13, fontWeight: '600', color: ElixColors.inkMuted },
  filterTabTextActive: { color: '#fff' },
  container: { flex: 1 },
  listContainer: { padding: 16, gap: 12 },
  bookingCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.lg,
    padding: 16,
    ...ElixShadows.md,
    marginBottom: 4,
  },
  bookingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  bookingNum: { fontSize: 14, fontWeight: '700', color: ElixColors.ink },
  bookingDate: { fontSize: 12, color: ElixColors.inkMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  urgentPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentPillText: { color: '#DC2626', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  timeText: { fontSize: 12, color: ElixColors.inkMuted },
  itemsList: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 13, color: ElixColors.ink, flex: 1 },
  itemPrice: { fontSize: 13, fontWeight: '600', color: ElixColors.ink },
  pricingSection: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, marginTop: 8 },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  pricingLabel: { fontSize: 12, color: ElixColors.inkMuted },
  pricingValue: { fontSize: 12, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 6, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: ElixColors.ink },
  totalValue: { fontSize: 14, fontWeight: '800', color: ElixColors.ink },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  addressText: { fontSize: 12, color: ElixColors.inkMuted, flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: ElixColors.blue },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ElixColors.ink, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: ElixColors.inkMuted, textAlign: 'center', marginTop: 6 },
  signInBtn: {
    marginTop: 20,
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
