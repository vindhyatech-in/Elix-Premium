import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useBookings, useCancelBooking, useRescheduleBooking } from '@/hooks/useBookings';
import { getBaseHost } from '@/lib/apiClient';
import type { Booking, BookingItem, IncludedSnapshotItem } from '@/types/api';

type FilterTab = 'all' | 'upcoming' | 'completed' | 'cancelled';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  upcoming:    { bg: '#EFF6FF', text: '#2563EB', label: 'Pending' },
  pending:     { bg: '#EFF6FF', text: '#2563EB', label: 'Pending' },
  confirmed:   { bg: '#F0FDF4', text: '#16A34A', label: 'Confirmed' },
  assigned:    { bg: '#EEF2FF', text: '#4F46E5', label: 'Beautician Assigned' },
  on_the_way:  { bg: '#FEF3C7', text: '#D97706', label: 'On The Way' },
  in_progress: { bg: '#E0E7FF', text: '#4338CA', label: 'In Progress' },
  completed:   { bg: '#ECFDF5', text: '#059669', label: 'Completed' },
  cancelled:   { bg: '#FEE2E2', text: '#DC2626', label: 'Cancelled' },
};

const UPCOMING_STATUSES = ['upcoming', 'pending', 'confirmed', 'assigned', 'on_the_way', 'in_progress'];

const REGULAR_SLOTS = [
  { key: 'morning', label: 'Morning', time: '9:00 AM – 12:00 PM', icon: 'sunny-outline' },
  { key: 'afternoon', label: 'Afternoon', time: '12:00 PM – 4:00 PM', icon: 'partly-sunny-outline' },
  { key: 'evening', label: 'Evening', time: '4:00 PM – 8:00 PM', icon: 'moon-outline' },
];

function formatBookingDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getAvailableDates() {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    const label =
      i === 0
        ? 'Today'
        : i === 1
        ? 'Tomorrow'
        : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ iso, label, dateObj: d });
  }
  return dates;
}

function getExpressTimes(selectedDateStr: string) {
  const times: string[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = selectedDateStr === todayStr;

  let startMins = isToday ? now.getHours() * 60 + now.getMinutes() + 50 : 8 * 60;
  const rem = startMins % 15;
  if (rem > 0) startMins += 15 - rem;

  const endMins = 21 * 60; // 9:00 PM
  for (let m = startMins; m <= endMins; m += 15) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const hhStr = String(hh).padStart(2, '0');
    const mmStr = String(mm).padStart(2, '0');
    times.push(`${hhStr}:${mmStr}`);
  }
  return times;
}

function BookingCard({
  booking,
  onInvoice,
  onCancel,
  onReschedule,
  onRebook,
  onHelp,
  onViewDetails,
  onRateOrder,
}: {
  booking: Booking;
  onInvoice: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onReschedule: (b: Booking) => void;
  onRebook: (b: Booking) => void;
  onHelp: (b: Booking) => void;
  onViewDetails: (b: Booking) => void;
  onRateOrder: (b: Booking) => void;
}) {
  const isPendingOrConfirmed = ['upcoming', 'pending', 'confirmed'].includes(booking.status);
  const isAssigned = booking.status === 'assigned' || !!booking.assigned_beautician;
  const isOnTheWay = booking.status === 'on_the_way';
  const isInProgress = booking.status === 'in_progress';
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';
  const isPastAssignment = isOnTheWay || isInProgress || isCompleted;

  // Refine status display: when beautician is assigned while booking is upcoming/pending/confirmed/assigned, display "Beautician Assigned"
  const computedStatus = (
    (['upcoming', 'pending', 'confirmed', 'assigned'].includes(booking.status)) && isAssigned
  ) ? 'assigned' : booking.status;

  const statusInfo =
    STATUS_COLORS[computedStatus] ?? {
      bg: '#EEF2FF',
      text: '#4F46E5',
      label: computedStatus === 'assigned' ? 'Beautician Assigned' : (booking.status_display || 'Scheduled'),
    };

  // Rule:
  // - When booking done: cancel, reschedule, invoice.
  // - After beautician assigned: call beautician.
  // - After on the way status: remove reschedule and cancel.
  // - When on the way: show OTP.
  // - After job ends: option for rating overall.
  const canCancelAndReschedule =
    (isPendingOrConfirmed || booking.status === 'assigned') &&
    booking.can_cancel &&
    !isOnTheWay &&
    !isInProgress &&
    !isCompleted &&
    !isCancelled;

  const showCallBeautician = (isAssigned || isPastAssignment) && !isCompleted && !isCancelled;

  return (
    <Pressable style={styles.bookingCard} onPress={() => onViewDetails(booking)}>
      {/* Header row */}
      <View style={styles.bookingCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingNum}>#{booking.booking_number}</Text>
          <Text style={styles.bookingDate}>
            {formatBookingDate(booking.scheduled_date)} ·{' '}
            {booking.booking_type === 'urgent'
              ? (booking.exact_time ? `${booking.exact_time} (Express)` : 'Express 50-min')
              : (booking.time_slot_display ?? booking.time_slot ?? 'Scheduled')}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          {booking.booking_type === 'urgent' ? (
            <View style={styles.urgentPill}>
              <Text style={styles.urgentPillText}>EXPRESS</Text>
            </View>
          ) : null}
          <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusPillText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={ElixColors.inkMuted} style={{ marginLeft: 2 }} />
        </View>
      </View>

      {/* Assigned Beautician Block */}
      {Boolean(isAssigned || isPastAssignment) ? (
        <View style={styles.beauticianRow}>
          <View style={styles.beauticianLeft}>
            {booking.assigned_beautician?.photo ? (
              <Image
                source={{
                  uri: booking.assigned_beautician.photo.startsWith('http')
                    ? booking.assigned_beautician.photo
                    : `${getBaseHost()}${booking.assigned_beautician.photo}`,
                }}
                style={styles.beauticianAvatar}
              />
            ) : (
              <View style={styles.beauticianAvatarFallback}>
                <Ionicons name="person" size={16} color={ElixColors.blue} />
              </View>
            )}
            <View>
              <Text style={styles.beauticianSubtitle}>Your Beautician</Text>
              <Text style={styles.beauticianName}>
                {booking.assigned_beautician?.name || 'Salon Professional Assigned'}
              </Text>
            </View>
          </View>
          {Boolean(!isCompleted && !isCancelled) ? (
            <Pressable
              style={styles.callBeauticianBtn}
              onPress={(e) => {
                e.stopPropagation();
                if (booking.assigned_beautician?.phone) {
                  Linking.openURL(`tel:${booking.assigned_beautician.phone}`);
                } else {
                  onHelp(booking);
                }
              }}
              hitSlop={6}
            >
              <Ionicons name="call" size={13} color={ElixColors.blue} />
              <Text style={styles.callBeauticianBtnText}>Call</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Start OTP Banner (when beautician is on the way) */}
      {Boolean(isOnTheWay) ? (
        <View style={styles.otpBanner}>
          <View style={styles.otpLeft}>
            <Ionicons name="shield-checkmark" size={18} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.otpTitle}>Beautician On The Way</Text>
              <Text style={styles.otpSubtitle}>
                {booking.start_otp
                  ? 'Share this OTP with artist to start:'
                  : 'Your beautician is en route to your home.'}
              </Text>
            </View>
          </View>
          {Boolean(booking.start_otp) ? (
            <View style={styles.otpCodeBox}>
              <Text style={styles.otpCodeText}>{booking.start_otp}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Items list */}
      <View style={styles.itemsList}>
        {booking.items.map((item, i) => (
          <View key={i} style={styles.itemWrapper}>
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.name}
                {item.quantity > 1 ? ` × ${item.quantity}` : ''}
              </Text>
              <Text style={styles.itemPrice}>Rs.{(item.price * item.quantity).toFixed(0)}</Text>
            </View>
            {Boolean(item.included && item.included.length > 0) ? (
              <View style={styles.includedList}>
                {item.included!.map((inc, incIdx) => {
                  const text =
                    typeof inc === 'string'
                      ? inc
                      : `${inc.name}${inc.variant_label ? ` (${inc.variant_label})` : ''}`;
                  return (
                    <Text key={incIdx} style={styles.includedItemText}>
                      • {text}
                    </Text>
                  );
                })}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {/* Address & Total */}
      <View style={styles.footerRow}>
        <View style={styles.addressBox}>
          <Ionicons name="location-outline" size={14} color={ElixColors.inkMuted} />
          <Text style={styles.addressText} numberOfLines={1}>
            {booking.address_label}: {booking.address_text}
          </Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rs.{booking.total_amount.toFixed(0)}</Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        {/* Call Beautician button (if assigned & active) */}
        {Boolean(showCallBeautician) ? (
          <Pressable
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              if (booking.assigned_beautician?.phone) {
                Linking.openURL(`tel:${booking.assigned_beautician.phone}`);
              } else {
                onHelp(booking);
              }
            }}
            hitSlop={6}
            accessibilityLabel="Call Assigned Beautician"
          >
            <Ionicons name="call-outline" size={14} color={ElixColors.blue} />
            <Text style={styles.actionBtnText}>Call Beautician</Text>
          </Pressable>
        ) : null}

        {/* Reschedule button (before on the way) */}
        {Boolean(canCancelAndReschedule) ? (
          <Pressable
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onReschedule(booking);
            }}
            hitSlop={6}
            accessibilityLabel="Reschedule booking"
          >
            <Ionicons name="calendar-outline" size={14} color={ElixColors.blue} />
            <Text style={styles.actionBtnText}>Reschedule</Text>
          </Pressable>
        ) : null}

        {/* Cancel button (before on the way) */}
        {Boolean(canCancelAndReschedule) ? (
          <Pressable
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={(e) => {
              e.stopPropagation();
              onCancel(booking);
            }}
            hitSlop={6}
            accessibilityLabel="Cancel this booking"
          >
            <Ionicons name="close-outline" size={14} color="#DC2626" />
            <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Cancel</Text>
          </Pressable>
        ) : null}

        {/* Invoice button (always available) */}
        <Pressable
          style={styles.actionBtn}
          onPress={(e) => {
            e.stopPropagation();
            onInvoice(booking);
          }}
          hitSlop={6}
          accessibilityLabel="View Invoice and Receipt"
        >
          <Ionicons name="receipt-outline" size={14} color={ElixColors.blue} />
          <Text style={styles.actionBtnText}>Invoice</Text>
        </Pressable>

        {/* Rate Order button (after job ends / completed) */}
        {Boolean(isCompleted) ? (
          <Pressable
            style={[styles.actionBtn, styles.rateBtn]}
            onPress={(e) => {
              e.stopPropagation();
              onRateOrder(booking);
            }}
            hitSlop={6}
            accessibilityLabel="Rate this booking"
          >
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={[styles.actionBtnText, { color: '#B45309' }]}>
              {booking.feedback_comment ? 'Feedback Added' : 'Rate Order'}
            </Text>
          </Pressable>
        ) : null}

        {/* Rebook button for completed or cancelled */}
        {Boolean((isCompleted || isCancelled) && booking.rebook_items && booking.rebook_items.length > 0) ? (
          <Pressable
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onRebook(booking);
            }}
            hitSlop={6}
            accessibilityLabel="Rebook these services"
          >
            <Ionicons name="repeat-outline" size={14} color={ElixColors.blue} />
            <Text style={styles.actionBtnText}>Rebook</Text>
          </Pressable>
        ) : null}

        {/* Help button for completed or cancelled */}
        {Boolean(isCompleted || isCancelled) ? (
          <Pressable
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onHelp(booking);
            }}
            hitSlop={6}
            accessibilityLabel="Help for this booking"
          >
            <Ionicons name="help-circle-outline" size={14} color={ElixColors.blue} />
            <Text style={styles.actionBtnText}>Help</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function BookingsScreen() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const { isLoggedIn, user } = useAuthStore();
  const { totalItems, addItem } = useCartStore();
  const { data: bookings, isLoading, refetch } = useBookings(isLoggedIn);
  const cancelBooking = useCancelBooking();
  const rescheduleBooking = useRescheduleBooking();

  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState<Booking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Reschedule state
  const [reschedulingBooking, setReschedulingBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleType, setRescheduleType] = useState<'regular' | 'urgent'>('regular');
  const [rescheduleSlot, setRescheduleSlot] = useState('morning');
  const [rescheduleExactTime, setRescheduleExactTime] = useState('10:00');
  const [isRescheduling, setIsRescheduling] = useState(false);

  const [statusToast, setStatusToast] = useState<{ message: string; showCart?: boolean } | null>(null);

  const availableDates = useMemo(() => getAvailableDates(), []);
  const expressTimes = useMemo(() => getExpressTimes(rescheduleDate), [rescheduleDate]);

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const filtered = useMemo(() => {
    return (bookings ?? []).filter((b) => {
      // 1. Status Filter
      if (activeFilter === 'upcoming') {
        const isAssigned = b.status === 'assigned' || !!b.assigned_beautician;
        const eff = (['upcoming', 'pending', 'confirmed', 'assigned'].includes(b.status) && isAssigned) ? 'assigned' : b.status;
        if (!UPCOMING_STATUSES.includes(b.status) && !UPCOMING_STATUSES.includes(eff)) return false;
      } else if (activeFilter !== 'all') {
        if (b.status !== activeFilter) return false;
      }

      // 2. Date Filter
      if (dateFilter) {
        const bDate = b.scheduled_date.slice(0, 10);
        if (bDate !== dateFilter) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNum = b.booking_number.toLowerCase().includes(q);
        const matchAddr = `${b.address_label} ${b.address_text}`.toLowerCase().includes(q);
        const matchItem = b.items.some((it) => it.name.toLowerCase().includes(q));
        const matchBeautician = b.assigned_beautician?.name.toLowerCase().includes(q) ?? false;
        if (!matchNum && !matchAddr && !matchItem && !matchBeautician) return false;
      }

      return true;
    });
  }, [bookings, activeFilter, dateFilter, searchQuery]);

  function handleInvoice(booking: Booking) {
    setSelectedInvoiceBooking(booking);
  }

  function handleCancelClick(booking: Booking) {
    setCancellingBooking(booking);
  }

  async function handleConfirmCancel() {
    if (!cancellingBooking) return;
    setIsCancelling(true);
    try {
      await cancelBooking.mutateAsync(cancellingBooking.booking_number);
      const bNum = cancellingBooking.booking_number;
      setCancellingBooking(null);
      setStatusToast({ message: `Booking #${bNum} has been cancelled successfully.` });
      setTimeout(() => setStatusToast(null), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not cancel booking.';
      Alert.alert('Cancellation Error', msg);
    } finally {
      setIsCancelling(false);
    }
  }

  function openRescheduleModal(booking: Booking) {
    setReschedulingBooking(booking);
    setRescheduleDate(booking.scheduled_date.slice(0, 10));
    setRescheduleType(booking.booking_type || 'regular');
    setRescheduleSlot(booking.time_slot || 'morning');
    setRescheduleExactTime(booking.exact_time || '10:00');
  }

  async function handleConfirmReschedule() {
    if (!reschedulingBooking) return;
    setIsRescheduling(true);
    try {
      await rescheduleBooking.mutateAsync({
        bookingNumber: reschedulingBooking.booking_number,
        date: rescheduleDate,
        booking_type: rescheduleType,
        time_slot: rescheduleType === 'regular' ? rescheduleSlot : undefined,
        exact_time: rescheduleType === 'urgent' ? rescheduleExactTime : undefined,
      });
      const bNum = reschedulingBooking.booking_number;
      setReschedulingBooking(null);
      setStatusToast({ message: `Booking #${bNum} has been rescheduled successfully.` });
      setTimeout(() => setStatusToast(null), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not reschedule booking.';
      Alert.alert('Reschedule Error', msg);
    } finally {
      setIsRescheduling(false);
    }
  }

  function handleRebook(booking: Booking) {
    if (!booking.rebook_items || booking.rebook_items.length === 0) {
      Alert.alert('Rebook', 'Sorry, these items are no longer available in the catalog.');
      return;
    }
    let addedCount = 0;
    booking.rebook_items.forEach((item) => {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        addItem({
          variantId: item.variantId,
          packageId: item.packageId,
          isPackage: item.isPackage,
          name: item.name,
          price: item.price,
          duration: 30,
        });
      }
      addedCount += qty;
    });

    setStatusToast({
      message: `Added ${addedCount} item${addedCount > 1 ? 's' : ''} to your cart.`,
      showCart: true,
    });
    setTimeout(() => setStatusToast(null), 6000);
  }

  function handleHelp(booking: Booking) {
    const text = `Hello Elix Support, I need help with my booking #${booking.booking_number}.`;
    const url = `https://wa.me/917440670533?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Support', 'Please contact support at +91 74406 70533.');
    });
  }

  async function handleDownloadPdf(booking: Booking) {
    try {
      const host = getBaseHost();
      const pdfUrl = `${host}/api/v1/bookings/${booking.booking_number}/invoice/pdf/`;
      if (Platform.OS === 'web') {
        window.open(pdfUrl, '_blank');
      } else {
        await Linking.openURL(pdfUrl);
      }
    } catch {
      Alert.alert('Download Receipt', 'Could not open receipt PDF. Please try again.');
    }
  }

  const hasActiveFilters = searchQuery.trim().length > 0 || dateFilter.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        location="Indore, MP"
        cartItemCount={totalItems}
        onSearchPress={() => router.push({ pathname: '/(tabs)/services', params: { autoSearch: '1' } })}
        onCartPress={() => router.push({ pathname: '/(tabs)/services', params: { openCart: '1' } })}
      />

      {/* Search & Filter Header Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={ElixColors.inkMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order ID, service, or address…"
            placeholderTextColor={ElixColors.inkMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {Boolean(searchQuery.length > 0) ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={ElixColors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        {Boolean(hasActiveFilters) ? (
          <Pressable
            style={styles.clearFiltersBtn}
            onPress={() => {
              setSearchQuery('');
              setDateFilter('');
            }}
          >
            <Text style={styles.clearFiltersBtnText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Date Filter Quick Strip (Optional) */}
      {Boolean(dateFilter) ? (
        <View style={styles.activeDateBanner}>
          <Ionicons name="calendar" size={13} color={ElixColors.blue} />
          <Text style={styles.activeDateText}>Filtered by date: {dateFilter}</Text>
          <Pressable onPress={() => setDateFilter('')} hitSlop={6}>
            <Ionicons name="close" size={14} color={ElixColors.blue} />
          </Pressable>
        </View>
      ) : null}

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

      {/* Status Toast Banner */}
      {Boolean(statusToast) ? (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#166534" />
          <Text style={styles.toastBannerText}>{statusToast!.message}</Text>
          {Boolean(statusToast!.showCart) ? (
            <Pressable
              style={styles.viewCartToastBtn}
              onPress={() => router.push({ pathname: '/(tabs)/services', params: { openCart: '1' } })}
            >
              <Text style={styles.viewCartToastBtnText}>View Cart</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setStatusToast(null)} hitSlop={6}>
            <Ionicons name="close" size={16} color="#166534" />
          </Pressable>
        </View>
      ) : null}

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
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters
                ? 'No bookings matched your search criteria.'
                : 'Your bookings will appear here once you place an order.'}
            </Text>
            {Boolean(hasActiveFilters) ? (
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  setSearchQuery('');
                  setDateFilter('');
                  setActiveFilter('all');
                }}
              >
                <Text style={styles.resetBtnText}>Reset Filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filtered.map((b) => (
              <BookingCard
                key={b.booking_number}
                booking={b}
                onInvoice={handleInvoice}
                onCancel={handleCancelClick}
                onReschedule={openRescheduleModal}
                onRebook={handleRebook}
                onHelp={handleHelp}
                onViewDetails={(booking) => {
                  const cleanNum = booking.booking_number.replace(/^#/, '').trim();
                  queryClient.setQueryData(['booking', cleanNum], booking);
                  router.push({
                    pathname: '/booking-detail',
                    params: { booking_number: cleanNum },
                  });
                }}
                onRateOrder={(booking) => {
                  const cleanNum = booking.booking_number.replace(/^#/, '').trim();
                  queryClient.setQueryData(['booking', cleanNum], booking);
                  router.push({
                    pathname: '/booking-detail',
                    params: { booking_number: cleanNum },
                  });
                }}
              />
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal
        visible={!!reschedulingBooking}
        transparent
        animationType="slide"
        onRequestClose={() => !isRescheduling && setReschedulingBooking(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isRescheduling && setReschedulingBooking(null)}
        >
          <Pressable style={styles.rescheduleModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Reschedule Booking</Text>
                <Text style={styles.modalSub}>#{reschedulingBooking?.booking_number}</Text>
              </View>
              <Pressable
                onPress={() => !isRescheduling && setReschedulingBooking(null)}
                hitSlop={8}
                disabled={isRescheduling}
              >
                <Ionicons name="close" size={20} color={ElixColors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Step 1: Select Date */}
              <Text style={styles.sectionHeading}>1. SELECT NEW DATE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateSelectorContent}
              >
                {availableDates.map((item) => {
                  const isSelected = rescheduleDate === item.iso;
                  return (
                    <Pressable
                      key={item.iso}
                      style={[styles.dateCard, isSelected && styles.dateCardActive]}
                      onPress={() => setRescheduleDate(item.iso)}
                    >
                      <Text style={[styles.dateCardDay, isSelected && styles.dateCardDayActive]}>
                        {item.dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </Text>
                      <Text style={[styles.dateCardNum, isSelected && styles.dateCardNumActive]}>
                        {item.dateObj.getDate()}
                      </Text>
                      <Text style={[styles.dateCardMonth, isSelected && styles.dateCardMonthActive]}>
                        {item.dateObj.toLocaleDateString('en-IN', { month: 'short' })}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Step 2: Appointment Type */}
              <Text style={[styles.sectionHeading, { marginTop: 18 }]}>2. APPOINTMENT TYPE</Text>
              <View style={styles.typeToggleRow}>
                <Pressable
                  style={[styles.typeOptionCard, rescheduleType === 'regular' && styles.typeOptionCardActive]}
                  onPress={() => setRescheduleType('regular')}
                >
                  <Ionicons
                    name="calendar"
                    size={18}
                    color={rescheduleType === 'regular' ? ElixColors.blue : ElixColors.inkMuted}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text
                      style={[
                        styles.typeOptionTitle,
                        rescheduleType === 'regular' && styles.typeOptionTitleActive,
                      ]}
                    >
                      Regular Slots
                    </Text>
                    <Text style={styles.typeOptionSub}>Free standard scheduling</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.typeOptionCard, rescheduleType === 'urgent' && styles.typeOptionCardActive]}
                  onPress={() => setRescheduleType('urgent')}
                >
                  <Ionicons
                    name="flash"
                    size={18}
                    color={rescheduleType === 'urgent' ? ElixColors.blue : ElixColors.inkMuted}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text
                      style={[
                        styles.typeOptionTitle,
                        rescheduleType === 'urgent' && styles.typeOptionTitleActive,
                      ]}
                    >
                      Express Priority
                    </Text>
                    <Text style={styles.typeOptionSub}>+Rs.99 (50-min lead)</Text>
                  </View>
                </Pressable>
              </View>

              {/* Step 3: Slot / Exact Time */}
              <Text style={[styles.sectionHeading, { marginTop: 18 }]}>
                {rescheduleType === 'regular' ? '3. SELECT TIME SLOT' : '3. SELECT EXACT ARRIVAL TIME'}
              </Text>

              {rescheduleType === 'regular' ? (
                <View style={styles.slotGrid}>
                  {REGULAR_SLOTS.map((slot) => {
                    const isSelected = rescheduleSlot === slot.key;
                    return (
                      <Pressable
                        key={slot.key}
                        style={[styles.slotCard, isSelected && styles.slotCardActive]}
                        onPress={() => setRescheduleSlot(slot.key)}
                      >
                        <Ionicons
                          name={slot.icon as any}
                          size={18}
                          color={isSelected ? ElixColors.blue : ElixColors.inkMuted}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.slotCardLabel, isSelected && styles.slotCardLabelActive]}>
                            {slot.label}
                          </Text>
                          <Text style={styles.slotCardTime}>{slot.time}</Text>
                        </View>
                        {Boolean(isSelected) ? (
                          <Ionicons name="checkmark-circle" size={18} color={ElixColors.blue} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timeSelectorContent}
                >
                  {expressTimes.length === 0 ? (
                    <Text style={styles.noSlotsText}>No express slots available for this date.</Text>
                  ) : (
                    expressTimes.map((timeStr) => {
                      const isSelected = rescheduleExactTime === timeStr;
                      return (
                        <Pressable
                          key={timeStr}
                          style={[styles.timeChip, isSelected && styles.timeChipActive]}
                          onPress={() => setRescheduleExactTime(timeStr)}
                        >
                          <Text style={[styles.timeChipText, isSelected && styles.timeChipTextActive]}>
                            {timeStr}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </ScrollView>

            <View style={styles.rescheduleActions}>
              <Pressable
                style={[styles.confirmRescheduleBtn, isRescheduling && styles.btnDisabled]}
                onPress={handleConfirmReschedule}
                disabled={isRescheduling}
              >
                {isRescheduling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmRescheduleBtnText}>Confirm Reschedule</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelRescheduleBtn}
                onPress={() => setReschedulingBooking(null)}
                disabled={isRescheduling}
              >
                <Text style={styles.cancelRescheduleBtnText}>Keep Current Slot</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Cancellation Confirmation Modal */}
      <Modal
        visible={!!cancellingBooking}
        transparent
        animationType="fade"
        onRequestClose={() => !isCancelling && setCancellingBooking(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isCancelling && setCancellingBooking(null)}
        >
          <Pressable style={styles.confirmModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.warningIconCircle}>
              <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Cancel Booking?</Text>
            <Text style={styles.confirmSubtitle}>
              Are you sure you want to cancel booking #{cancellingBooking?.booking_number}?
              {'\n'}Free cancellation is available anytime before the beautician is assigned.
            </Text>

            <View style={styles.confirmBtnRow}>
              <Pressable
                style={styles.keepBtn}
                onPress={() => setCancellingBooking(null)}
                disabled={isCancelling}
              >
                <Text style={styles.keepBtnText}>Keep Booking</Text>
              </Pressable>

              <Pressable
                style={[styles.confirmCancelBtn, isCancelling && styles.btnDisabled]}
                onPress={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmCancelBtnText}>Yes, Cancel</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Invoice & Receipt Modal */}
      <Modal
        visible={!!selectedInvoiceBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedInvoiceBooking(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedInvoiceBooking(null)}
        >
          <Pressable style={styles.invoiceModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            {/* Modal Header */}
            <View style={styles.invoiceHeaderRow}>
              <View>
                <Text style={styles.invoiceTitle}>Booking Receipt</Text>
                <Text style={styles.invoiceSub}>#{selectedInvoiceBooking?.booking_number}</Text>
              </View>
              <Pressable
                onPress={() => setSelectedInvoiceBooking(null)}
                hitSlop={8}
                style={styles.invoiceCloseBtn}
              >
                <Ionicons name="close" size={20} color={ElixColors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {selectedInvoiceBooking ? (
                <View style={styles.receiptBody}>
                  {/* Brand Ribbon */}
                  <View style={styles.receiptBrandRibbon}>
                    <View>
                      <Text style={styles.brandTitle}>
                        <Text style={{ color: ElixColors.blue }}>E</Text>LIX PREMIUM
                      </Text>
                      <Text style={styles.brandTagline}>Salon at Home · Indore</Text>
                    </View>
                    <View
                      style={[
                        styles.receiptStatusPill,
                        { backgroundColor: STATUS_COLORS[selectedInvoiceBooking!.status]?.bg ?? '#EFF6FF' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.receiptStatusText,
                          { color: STATUS_COLORS[selectedInvoiceBooking!.status]?.text ?? ElixColors.blue },
                        ]}
                      >
                        {STATUS_COLORS[selectedInvoiceBooking!.status]?.label ?? selectedInvoiceBooking!.status_display}
                      </Text>
                    </View>
                  </View>

                  {/* Metadata Info Grid */}
                  <View style={styles.receiptInfoGrid}>
                    <View style={styles.receiptInfoCol}>
                      <Text style={styles.infoLabel}>DATE & TIME</Text>
                      <Text style={styles.infoValue}>
                        {formatBookingDate(selectedInvoiceBooking!.scheduled_date)}
                      </Text>
                      <Text style={styles.infoSub}>
                        {selectedInvoiceBooking!.booking_type === 'urgent'
                          ? (selectedInvoiceBooking!.exact_time ? `${selectedInvoiceBooking!.exact_time} (Express)` : 'Express 50-min')
                          : (selectedInvoiceBooking!.time_slot_display ?? selectedInvoiceBooking!.time_slot ?? 'Scheduled')}
                      </Text>
                    </View>

                    <View style={styles.receiptInfoCol}>
                      <Text style={styles.infoLabel}>CUSTOMER</Text>
                      <Text style={styles.infoValue}>
                        {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.email || 'Customer')}
                      </Text>
                      <Text style={styles.infoSub}>{user?.phone || user?.email || ''}</Text>
                    </View>
                  </View>

                  {/* Service Address */}
                  <View style={styles.receiptAddressBox}>
                    <Text style={styles.infoLabel}>SERVICE ADDRESS</Text>
                    <Text style={styles.infoAddressText}>
                      <Text style={{ fontWeight: '700' }}>{selectedInvoiceBooking!.address_label}: </Text>
                      {selectedInvoiceBooking!.address_text}
                    </Text>
                  </View>

                  {/* Itemized Table */}
                  <Text style={styles.tableHeading}>ITEMIZED SERVICES</Text>
                  <View style={styles.receiptTable}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeadCol, { flex: 2 }]}>Service</Text>
                      <Text style={[styles.tableHeadCol, { width: 45, textAlign: 'center' }]}>Qty</Text>
                      <Text style={[styles.tableHeadCol, { width: 75, textAlign: 'right' }]}>Amount</Text>
                    </View>
                    {selectedInvoiceBooking!.items.map((it, idx) => (
                      <View key={idx} style={styles.tableDataRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.tableNameCol}>{it.name}</Text>
                          {Boolean(it.included && it.included.length > 0) ? (
                            <Text style={styles.tableIncludedSub}>
                              {it.included!
                                .map((inc) => (typeof inc === 'string' ? inc : inc.name))
                                .join(', ')}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.tableQtyCol, { width: 45, textAlign: 'center' }]}>{it.quantity}</Text>
                        <Text style={[styles.tablePriceCol, { width: 75, textAlign: 'right' }]}>
                          Rs.{(it.price * it.quantity).toFixed(0)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Financial Breakdown */}
                  <View style={styles.receiptSummary}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal</Text>
                      <Text style={styles.summaryVal}>Rs.{selectedInvoiceBooking!.subtotal.toFixed(0)}</Text>
                    </View>
                    {Boolean(selectedInvoiceBooking!.discount_amount > 0) ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Coupon Discount</Text>
                        <Text style={[styles.summaryVal, { color: ElixColors.green }]}>
                          -Rs.{selectedInvoiceBooking!.discount_amount.toFixed(0)}
                        </Text>
                      </View>
                    ) : null}
                    {Boolean(selectedInvoiceBooking!.booking_type === 'urgent') ? (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Express Priority Fee</Text>
                        <Text style={[styles.summaryVal, { color: ElixColors.blue }]}>+Rs.99</Text>
                      </View>
                    ) : null}
                    <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                      <Text style={styles.summaryTotalLabel}>Total Amount</Text>
                      <Text style={styles.summaryTotalVal}>Rs.{selectedInvoiceBooking!.total_amount.toFixed(0)}</Text>
                    </View>
                  </View>

                  {/* Payment Mode Note */}
                  <View style={styles.paymentModeBox}>
                    <Ionicons
                      name={selectedInvoiceBooking.payment_status === 'paid' ? 'checkmark-circle' : 'cash-outline'}
                      size={18}
                      color={selectedInvoiceBooking.payment_status === 'paid' ? ElixColors.green : '#B45309'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentModeTitle}>
                        {selectedInvoiceBooking.payment_status === 'paid'
                          ? 'Paid Online via Razorpay'
                          : 'Payment at Home (Cash or UPI)'}
                      </Text>
                      <Text style={styles.paymentModeSub}>
                        {selectedInvoiceBooking.payment_status === 'paid'
                          ? 'Transaction completed successfully.'
                          : 'Please pay Rs.' + selectedInvoiceBooking.total_amount.toFixed(0) + ' to your artist upon completion.'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.invoiceModalActions}>
              <Pressable
                style={styles.downloadPdfBtn}
                onPress={() => handleDownloadPdf(selectedInvoiceBooking!)}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                <Text style={styles.downloadPdfBtnText}>Download PDF</Text>
              </Pressable>

              <Pressable
                style={styles.invoiceDoneBtn}
                onPress={() => setSelectedInvoiceBooking(null)}
              >
                <Text style={styles.invoiceDoneBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ElixColors.surface1 },

  // Search Bar Container
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: ElixColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: ElixColors.ink,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  clearFiltersBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.blue,
  },
  activeDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  activeDateText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.blue,
  },

  // Filter Bar
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

  // Booking Card
  bookingCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.lg,
    padding: 16,
    ...ElixShadows.md,
    marginBottom: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  bookingCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  bookingNum: { fontSize: 15, fontWeight: '800', color: ElixColors.ink },
  bookingDate: { fontSize: 12, color: ElixColors.inkMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  urgentPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgentPillText: { color: '#DC2626', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  // Beautician Row
  beauticianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  beauticianLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  beauticianAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
  },
  beauticianAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beauticianSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: ElixColors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  beauticianName: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
    marginTop: 1,
  },
  callBeauticianBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  callBeauticianBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.blue,
  },

  // Start OTP Banner
  otpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  otpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  otpTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  otpSubtitle: {
    fontSize: 11,
    color: '#047857',
  },
  otpCodeBox: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  otpCodeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },

  // Items List
  itemsList: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10, gap: 6 },
  itemWrapper: { marginBottom: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 13, color: ElixColors.ink, flex: 1, fontWeight: '500' },
  itemPrice: { fontSize: 13, fontWeight: '700', color: ElixColors.ink },
  includedList: { marginTop: 2, paddingLeft: 8 },
  includedItemText: { fontSize: 11, color: ElixColors.inkMuted, lineHeight: 16 },

  // Footer Row
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    marginTop: 8,
    gap: 10,
  },
  addressBox: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  addressText: { fontSize: 12, color: ElixColors.inkMuted, flex: 1 },
  totalBox: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  totalLabel: { fontSize: 12, fontWeight: '600', color: ElixColors.inkMuted },
  totalValue: { fontSize: 15, fontWeight: '900', color: ElixColors.ink },

  // Action Buttons
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  cancelBtn: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  rateBtn: {
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  detailsBtn: {
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: ElixColors.blue },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
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
  resetBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: ElixColors.ink },

  // Toast Banner
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
  },
  toastBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  viewCartToastBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#166534',
    borderRadius: 6,
  },
  viewCartToastBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal Overlay Shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },

  // Reschedule Modal
  rescheduleModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink },
  modalSub: { fontSize: 12, color: ElixColors.inkMuted, marginTop: 2 },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: ElixColors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dateSelectorContent: { gap: 8, paddingBottom: 4 },
  dateCard: {
    width: 60,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  dateCardActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  dateCardDay: { fontSize: 11, fontWeight: '600', color: ElixColors.inkMuted },
  dateCardDayActive: { color: '#FFFFFF' },
  dateCardNum: { fontSize: 16, fontWeight: '800', color: ElixColors.ink, marginVertical: 2 },
  dateCardNumActive: { color: '#FFFFFF' },
  dateCardMonth: { fontSize: 10, fontWeight: '600', color: ElixColors.inkMuted },
  dateCardMonthActive: { color: '#FFFFFF' },

  typeToggleRow: { flexDirection: 'row', gap: 10 },
  typeOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeOptionCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ElixColors.blue,
  },
  typeOptionTitle: { fontSize: 12, fontWeight: '700', color: ElixColors.ink },
  typeOptionTitleActive: { color: ElixColors.blue },
  typeOptionSub: { fontSize: 10, color: ElixColors.inkMuted, marginTop: 2 },

  slotGrid: { gap: 8 },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slotCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ElixColors.blue,
  },
  slotCardLabel: { fontSize: 13, fontWeight: '700', color: ElixColors.ink },
  slotCardLabelActive: { color: ElixColors.blue },
  slotCardTime: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 2 },

  timeSelectorContent: { gap: 8, paddingBottom: 4 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeChipActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  timeChipText: { fontSize: 12, fontWeight: '700', color: ElixColors.ink },
  timeChipTextActive: { color: '#FFFFFF' },
  noSlotsText: { fontSize: 12, color: ElixColors.inkMuted, paddingVertical: 10 },

  rescheduleActions: { gap: 8, marginTop: 16 },
  confirmRescheduleBtn: {
    backgroundColor: ElixColors.blue,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRescheduleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelRescheduleBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelRescheduleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },

  // Confirm Cancellation Modal
  confirmModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  warningIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ElixColors.ink,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Invoice Receipt Modal
  invoiceModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  invoiceSub: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  invoiceCloseBtn: {
    padding: 6,
  },
  receiptBody: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  receiptBrandRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: ElixColors.ink,
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  receiptStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  receiptStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  receiptInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  receiptInfoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: ElixColors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  infoSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  receiptAddressBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 14,
  },
  infoAddressText: {
    fontSize: 12,
    color: ElixColors.ink,
    lineHeight: 17,
  },
  tableHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: ElixColors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  receiptTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tableHeadCol: {
    fontSize: 11,
    fontWeight: '700',
    color: ElixColors.inkMuted,
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  tableNameCol: {
    fontSize: 12,
    color: ElixColors.ink,
    fontWeight: '600',
  },
  tableIncludedSub: {
    fontSize: 10,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  tableQtyCol: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    fontWeight: '600',
  },
  tablePriceCol: {
    fontSize: 12,
    color: ElixColors.ink,
    fontWeight: '700',
  },
  receiptSummary: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: ElixColors.inkMuted,
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  summaryTotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: ElixColors.blue,
  },
  paymentModeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentModeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  paymentModeSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  invoiceModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  downloadPdfBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ElixColors.blue,
    paddingVertical: 12,
    borderRadius: 12,
  },
  downloadPdfBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  invoiceDoneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 12,
  },
  invoiceDoneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
});
