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
  Platform,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import {
  useBookings,
  useBookingDetail,
  useCancelBooking,
  useRescheduleBooking,
  useSubmitItemReview,
  useSubmitFeedback,
} from '@/hooks/useBookings';
import { getBaseHost } from '@/lib/apiClient';
import type { Booking, BookingItem } from '@/types/api';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  upcoming:    { bg: '#EFF6FF', text: '#2563EB', label: 'Pending', icon: 'time-outline' },
  pending:     { bg: '#EFF6FF', text: '#2563EB', label: 'Pending', icon: 'time-outline' },
  confirmed:   { bg: '#F0FDF4', text: '#16A34A', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  assigned:    { bg: '#EEF2FF', text: '#4F46E5', label: 'Beautician Assigned', icon: 'person-outline' },
  on_the_way:  { bg: '#FEF3C7', text: '#D97706', label: 'On The Way', icon: 'bicycle-outline' },
  in_progress: { bg: '#E0E7FF', text: '#4338CA', label: 'Job Started', icon: 'flash-outline' },
  completed:   { bg: '#ECFDF5', text: '#059669', label: 'Completed', icon: 'checkmark-done-circle-outline' },
  cancelled:   { bg: '#FEE2E2', text: '#DC2626', label: 'Cancelled', icon: 'close-circle-outline' },
};

const REGULAR_SLOTS = [
  { key: 'morning', label: 'Morning', time: '9:00 AM – 12:00 PM', icon: 'sunny-outline' },
  { key: 'afternoon', label: 'Afternoon', time: '12:00 PM – 4:00 PM', icon: 'partly-sunny-outline' },
  { key: 'evening', label: 'Evening', time: '4:00 PM – 8:00 PM', icon: 'moon-outline' },
];

function formatBookingDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr || '';
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

  const endMins = 21 * 60;
  for (let m = startMins; m <= endMins; m += 15) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const hhStr = String(hh).padStart(2, '0');
    const mmStr = String(mm).padStart(2, '0');
    times.push(`${hhStr}:${mmStr}`);
  }
  return times;
}

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ booking_number?: string }>();
  const rawBookingNumber = params.booking_number || '';
  const cleanBookingNumber = rawBookingNumber.replace(/^#/, '').trim();

  const { isLoggedIn, user } = useAuthStore();
  const { addItem } = useCartStore();

  const { data: detailBooking, isLoading: isDetailLoading, refetch } = useBookingDetail(cleanBookingNumber, isLoggedIn);
  const { data: allBookings, isLoading: isAllLoading } = useBookings(isLoggedIn);

  // Fallback to list booking if detail query has not completed or returned 404
  const fallbackBooking = allBookings?.find(
    (b) => b.booking_number.replace(/^#/, '').trim() === cleanBookingNumber
  );
  const activeBooking = detailBooking || fallbackBooking;

  const cancelBookingMutation = useCancelBooking();
  const rescheduleBookingMutation = useRescheduleBooking();
  const submitItemReviewMutation = useSubmitItemReview();
  const submitFeedbackMutation = useSubmitFeedback();

  // Modals & form state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleType, setRescheduleType] = useState<'regular' | 'urgent'>('regular');
  const [rescheduleSlot, setRescheduleSlot] = useState('morning');
  const [rescheduleExactTime, setRescheduleExactTime] = useState('10:00');
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Ratings state for items
  const [itemRatings, setItemRatings] = useState<Record<number, number>>({});
  const [beauticianRating, setBeauticianRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const availableDates = React.useMemo(() => getAvailableDates(), []);
  const expressTimes = React.useMemo(() => getExpressTimes(rescheduleDate), [rescheduleDate]);

  React.useEffect(() => {
    if (activeBooking) {
      if (activeBooking.feedback_comment) {
        setFeedbackComment(activeBooking.feedback_comment);
      }
      const initialRatings: Record<number, number> = {};
      activeBooking.items.forEach((it) => {
        if (it.id && it.rating) {
          initialRatings[it.id] = it.rating;
        }
      });
      setItemRatings(initialRatings);
      if (activeBooking.items[0]?.beautician_rating) {
        setBeauticianRating(activeBooking.items[0].beautician_rating);
      }
    }
  }, [activeBooking]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleDownloadPdf() {
    if (!activeBooking) return;
    try {
      const host = getBaseHost();
      const pdfUrl = `${host}/api/v1/bookings/${activeBooking.booking_number}/invoice/pdf/`;
      if (Platform.OS === 'web') {
        window.open(pdfUrl, '_blank');
      } else {
        await Linking.openURL(pdfUrl);
      }
    } catch {
      Alert.alert('Download Receipt', 'Could not open receipt PDF. Please try again.');
    }
  }

  async function handleConfirmCancel() {
    if (!activeBooking) return;
    setIsCancelling(true);
    try {
      await cancelBookingMutation.mutateAsync(activeBooking.booking_number);
      setShowCancelModal(false);
      showToast(`Booking #${activeBooking.booking_number} cancelled.`);
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not cancel booking.';
      Alert.alert('Cancellation Error', msg);
    } finally {
      setIsCancelling(false);
    }
  }

  function openReschedule() {
    if (!activeBooking) return;
    setRescheduleDate(activeBooking.scheduled_date.slice(0, 10));
    setRescheduleType(activeBooking.booking_type || 'regular');
    setRescheduleSlot(activeBooking.time_slot || 'morning');
    setRescheduleExactTime(activeBooking.exact_time || '10:00');
    setShowRescheduleModal(true);
  }

  async function handleConfirmReschedule() {
    if (!activeBooking) return;
    setIsRescheduling(true);
    try {
      await rescheduleBookingMutation.mutateAsync({
        bookingNumber: activeBooking.booking_number,
        date: rescheduleDate,
        booking_type: rescheduleType,
        time_slot: rescheduleType === 'regular' ? rescheduleSlot : undefined,
        exact_time: rescheduleType === 'urgent' ? rescheduleExactTime : undefined,
      });
      setShowRescheduleModal(false);
      showToast(`Booking #${activeBooking.booking_number} rescheduled successfully.`);
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not reschedule booking.';
      Alert.alert('Reschedule Failed', msg);
    } finally {
      setIsRescheduling(false);
    }
  }

  async function handleRateItem(itemId: number, rating: number) {
    setItemRatings((prev) => ({ ...prev, [itemId]: rating }));
    try {
      await submitItemReviewMutation.mutateAsync({ itemId, rating });
      showToast(`Rated ${rating} star${rating > 1 ? 's' : ''}!`);
    } catch (err) {
      showToast('Could not save rating. Please try again.');
    }
  }

  async function handleRateBeautician(rating: number) {
    setBeauticianRating(rating);
    const firstItemId = activeBooking?.items[0]?.id;
    if (!firstItemId) return;
    try {
      await submitItemReviewMutation.mutateAsync({
        itemId: firstItemId,
        beautician_rating: rating,
      });
      showToast(`Rated beautician ${rating} star${rating > 1 ? 's' : ''}!`);
    } catch (err) {
      showToast('Could not save beautician rating.');
    }
  }

  async function handleSubmitOverallFeedback() {
    if (!activeBooking) return;
    if (!feedbackComment.trim()) {
      Alert.alert('Feedback', 'Please write your feedback before submitting.');
      return;
    }
    setIsSubmittingFeedback(true);
    try {
      await submitFeedbackMutation.mutateAsync({
        bookingNumber: activeBooking.booking_number,
        comment: feedbackComment.trim(),
      });
      setFeedbackSaved(true);
      showToast('Thank you! Your feedback has been saved.');
    } catch {
      Alert.alert('Error', 'Failed to save feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  function handleRebook() {
    if (!activeBooking || !activeBooking.rebook_items || activeBooking.rebook_items.length === 0) {
      Alert.alert('Rebook', 'Sorry, these items are no longer available in the catalog.');
      return;
    }
    let count = 0;
    activeBooking.rebook_items.forEach((item) => {
      const q = item.quantity || 1;
      for (let i = 0; i < q; i++) {
        addItem({
          variantId: item.variantId,
          packageId: item.packageId,
          isPackage: item.isPackage,
          name: item.name,
          price: item.price,
          duration: 30,
        });
      }
      count += q;
    });
    showToast(`Added ${count} item${count > 1 ? 's' : ''} to cart!`);
    router.push({ pathname: '/(tabs)/services', params: { openCart: '1' } });
  }

  function handleHelp() {
    if (!activeBooking) return;
    const text = `Hello Elix Support, I need help with my booking #${activeBooking.booking_number}.`;
    const url = `https://wa.me/917440670533?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Support', 'Please contact support at +91 74406 70533.');
    });
  }

  // Loading state when neither detail nor cached booking is ready
  if ((isDetailLoading || isAllLoading) && !activeBooking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ElixColors.blue} />
          <Text style={styles.loadingText}>Loading booking details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not found fallback only if strictly missing
  if (!activeBooking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={ElixColors.ink} />
          </Pressable>
          <Text style={styles.navTitle}>Booking Details</Text>
        </View>
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
          <Text style={styles.errorTitle}>Booking Not Found</Text>
          <Text style={styles.errorSub}>Could not load details for #{cleanBookingNumber || rawBookingNumber}.</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Lifecycle rule gates:
  const isPendingOrConfirmed = ['upcoming', 'pending', 'confirmed'].includes(activeBooking.status);
  const hasBeautician = !!activeBooking.assigned_beautician;
  const isAssigned = activeBooking.status === 'assigned' || hasBeautician;
  const isOnTheWay = activeBooking.status === 'on_the_way';
  const isInProgress = activeBooking.status === 'in_progress';
  const isCompleted = activeBooking.status === 'completed';
  const isCancelled = activeBooking.status === 'cancelled';
  const isPastAssignment = isOnTheWay || isInProgress || isCompleted;

  // Refine status display: when beautician is assigned while booking is upcoming/pending/confirmed/assigned, display "Beautician Assigned"
  const computedStatus = (
    (['upcoming', 'pending', 'confirmed', 'assigned'].includes(activeBooking.status)) && isAssigned
  ) ? 'assigned' : activeBooking.status;

  const statusConfig = STATUS_CONFIG[computedStatus] ?? {
    bg: '#EEF2FF',
    text: '#4F46E5',
    label: computedStatus === 'assigned' ? 'Beautician Assigned' : (activeBooking.status_display || 'Scheduled'),
    icon: 'person-outline',
  };

  // Rule:
  // - When booking done: cancel, reschedule, invoice.
  // - After beautician assigned: call beautician.
  // - After on the way status: remove option of reschedule and cancel.
  const canRescheduleAndCancel =
    (isPendingOrConfirmed || (activeBooking.status === 'assigned' && !isOnTheWay && !isInProgress)) &&
    activeBooking.can_cancel &&
    !isOnTheWay &&
    !isInProgress &&
    !isCompleted &&
    !isCancelled;

  const showCallBeautician = (isAssigned || isPastAssignment) && !isCompleted && !isCancelled;

  // Timeline Step Calculations
  const timelineSteps = [
    {
      title: 'Booking Placed',
      desc: activeBooking.created_at
        ? new Date(activeBooking.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : 'Confirmed',
      isDone: true,
      isActive: isPendingOrConfirmed && !hasBeautician && !isPastAssignment,
      icon: 'checkmark-circle',
    },
    {
      title: 'Beautician Assigned',
      desc: hasBeautician
        ? (activeBooking.assigned_beautician?.name ? `${activeBooking.assigned_beautician.name} Assigned` : 'Artist Assigned')
        : isPastAssignment
        ? 'Salon Professional Assigned'
        : 'Allocating top salon artist...',
      isDone: hasBeautician || isPastAssignment,
      isActive: isPendingOrConfirmed && hasBeautician,
      icon: 'person',
    },
    {
      title: 'On The Way',
      desc: isOnTheWay
        ? 'En route to your location'
        : (isInProgress || isCompleted ? 'Artist arrived at home' : 'Pending departure'),
      isDone: isInProgress || isCompleted,
      isActive: isOnTheWay,
      icon: 'bicycle',
    },
    {
      title: 'Service in Progress',
      desc: isInProgress
        ? 'Treatment underway at home'
        : (isCompleted ? 'Service finished' : 'Awaiting arrival OTP'),
      isDone: isCompleted,
      isActive: isInProgress,
      icon: 'sparkles',
    },
    {
      title: isCancelled ? 'Booking Cancelled' : 'Completed',
      desc: isCancelled
        ? 'Order was cancelled'
        : (isCompleted ? 'Completed successfully' : 'Final step'),
      isDone: isCompleted || isCancelled,
      isActive: false,
      isCancelled: isCancelled,
      icon: isCancelled ? 'close-circle' : 'flag',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={ElixColors.ink} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.navTitle}>#{activeBooking.booking_number}</Text>
          <Text style={styles.navSub}>Order Summary & Tracking</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Toast Banner */}
      {Boolean(toastMessage) ? (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#166534" />
          <Text style={styles.toastBannerText}>{toastMessage}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* On The Way Arrival OTP Banner */}
        {Boolean(isOnTheWay) ? (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Ionicons name="shield-checkmark" size={22} color="#059669" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.otpHeaderTitle}>Beautician is On The Way!</Text>
                <Text style={styles.otpHeaderSub}>
                  {activeBooking.start_otp
                    ? 'Share this verification code with your artist upon arrival to start:'
                    : 'Your beautician is en route to your home. Please keep verification OTP ready upon arrival.'}
                </Text>
              </View>
            </View>
            {Boolean(activeBooking.start_otp) ? (
              <View style={styles.otpNumberBox}>
                <Text style={styles.otpDigits}>{activeBooking.start_otp}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ORDER PROGRESS TIMELINE */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>ORDER STATUS & TIMELINE</Text>
          <View style={styles.timelineList}>
            {timelineSteps.map((step, index) => {
              const isLast = index === timelineSteps.length - 1;

              return (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timelineIconCol}>
                    <View
                      style={[
                        styles.timelineCircle,
                        step.isDone && styles.timelineCircleDone,
                        step.isActive && styles.timelineCircleActive,
                        step.isCancelled && styles.timelineCircleCancelled,
                      ]}
                    >
                      <Ionicons
                        name={step.icon as any}
                        size={14}
                        color={step.isDone || step.isActive || step.isCancelled ? '#FFFFFF' : '#94A3B8'}
                      />
                    </View>
                    {!isLast ? (
                      <View
                        style={[
                          styles.timelineLine,
                          step.isDone && styles.timelineLineDone,
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={styles.timelineTextCol}>
                    <Text
                      style={[
                        styles.timelineStepTitle,
                        (step.isDone || step.isActive) && { color: ElixColors.ink },
                        step.isActive && { color: ElixColors.blue },
                        step.isCancelled && { color: '#DC2626' },
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text style={styles.timelineStepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ASSIGNED BEAUTICIAN CARD */}
        {Boolean(hasBeautician || isPastAssignment || activeBooking.status === 'assigned') ? (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>YOUR ASSIGNED BEAUTICIAN</Text>
            <View style={styles.beauticianCardBody}>
              {activeBooking.assigned_beautician?.photo ? (
                <Image
                  source={{
                    uri: activeBooking.assigned_beautician.photo.startsWith('http')
                      ? activeBooking.assigned_beautician.photo
                      : `${getBaseHost()}${activeBooking.assigned_beautician.photo}`,
                  }}
                  style={styles.beauticianPhoto}
                />
              ) : (
                <View style={styles.beauticianPhotoPlaceholder}>
                  <Ionicons name="person" size={24} color={ElixColors.blue} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.beauticianName}>
                  {activeBooking.assigned_beautician?.name || 'Verified Salon Artist'}
                </Text>
                <Text style={styles.beauticianRole}>
                  {activeBooking.assigned_beautician?.role || 'Certified Salon Professional'}
                </Text>
                <View style={styles.beauticianRatingRow}>
                  <Ionicons name="star" size={13} color="#F59E0B" />
                  <Text style={styles.beauticianRatingText}>
                    {activeBooking.assigned_beautician?.rating
                      ? activeBooking.assigned_beautician.rating.toFixed(1)
                      : '5.0'}
                  </Text>
                </View>
              </View>
              {activeBooking.assigned_beautician?.phone ? (
                <Pressable
                  style={styles.callBeauticianBtn}
                  onPress={() => Linking.openURL(`tel:${activeBooking.assigned_beautician?.phone}`)}
                  hitSlop={8}
                >
                  <Ionicons name="call" size={16} color="#FFFFFF" />
                  <Text style={styles.callBeauticianBtnText}>Call</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.callBeauticianBtn}
                  onPress={handleHelp}
                  hitSlop={8}
                >
                  <Ionicons name="chatbubbles-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.callBeauticianBtnText}>Help</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* APPOINTMENT & DELIVERY INFO */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>APPOINTMENT & LOCATION</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={ElixColors.blue} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.infoLabel}>Scheduled Date & Time</Text>
              <Text style={styles.infoValue}>
                {formatBookingDate(activeBooking.scheduled_date)} ·{' '}
                {activeBooking.booking_type === 'urgent'
                  ? (activeBooking.exact_time ? `${activeBooking.exact_time} (Express Priority)` : 'Express 50-min')
                  : (activeBooking.time_slot_display ?? activeBooking.time_slot ?? 'Scheduled')}
              </Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <Ionicons name="location-outline" size={16} color={ElixColors.blue} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.infoLabel}>Service Address</Text>
              <Text style={styles.infoValue}>
                <Text style={{ fontWeight: '700' }}>{activeBooking.address_label}: </Text>
                {activeBooking.address_text}
                {activeBooking.address_pincode ? ` - ${activeBooking.address_pincode}` : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <Ionicons name="person-outline" size={16} color={ElixColors.blue} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>
                {activeBooking.customer_name || user?.first_name || 'Customer'}
                {activeBooking.customer_phone ? ` (${activeBooking.customer_phone})` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ITEMIZED SERVICES + RATING OPTION PER SERVICE */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>
            SERVICES ORDERED {isCompleted ? '· RATE YOUR SERVICES' : ''}
          </Text>
          {activeBooking.items.map((item: BookingItem, idx: number) => {
            const currentRating = (item.id && itemRatings[item.id]) || item.rating || 0;

            return (
              <View
                key={idx}
                style={[
                  styles.serviceItemCard,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginTop: 12 },
                ]}
              >
                <View style={styles.serviceItemHead}>
                  <Text style={styles.serviceItemName}>
                    {item.name}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                  </Text>
                  <Text style={styles.serviceItemPrice}>
                    Rs.{(item.price * item.quantity).toFixed(0)}
                  </Text>
                </View>

                {Boolean(item.included && item.included.length > 0) ? (
                  <View style={styles.serviceIncludedBox}>
                    {item.included!.map((inc, iIdx) => {
                      const text =
                        typeof inc === 'string'
                          ? inc
                          : `${inc.name}${inc.variant_label ? ` (${inc.variant_label})` : ''}`;
                      return (
                        <Text key={iIdx} style={styles.serviceIncludedText}>
                          • {text}
                        </Text>
                      );
                    })}
                  </View>
                ) : null}

                {/* Per-service rating option for completed booking */}
                {Boolean(isCompleted && item.id) ? (
                  <View style={styles.itemRatingSection}>
                    <Text style={styles.itemRatingPrompt}>
                      {currentRating > 0 ? `Your Rating: ${currentRating} ★` : 'Rate this service:'}
                    </Text>
                    <View style={styles.starPickerRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Pressable
                          key={star}
                          onPress={() => item.id && handleRateItem(item.id, star)}
                          hitSlop={6}
                          style={styles.starBtn}
                        >
                          <Ionicons
                            name={star <= currentRating ? 'star' : 'star-outline'}
                            size={22}
                            color={star <= currentRating ? '#F59E0B' : '#CBD5E1'}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* OVERALL ORDER RATING & FEEDBACK (COMPLETED JOBS) */}
        {Boolean(isCompleted) ? (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>OVERALL EXPERIENCE & FEEDBACK</Text>

            {Boolean(activeBooking.assigned_beautician) ? (
              <View style={styles.beauticianFeedbackRating}>
                <Text style={styles.feedbackSubLabel}>
                  Rate Beautician ({activeBooking.assigned_beautician?.name}):
                </Text>
                <View style={styles.starPickerRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => handleRateBeautician(star)}
                      hitSlop={6}
                      style={styles.starBtn}
                    >
                      <Ionicons
                        name={star <= beauticianRating ? 'star' : 'star-outline'}
                        size={22}
                        color={star <= beauticianRating ? '#F59E0B' : '#CBD5E1'}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={[styles.feedbackSubLabel, { marginTop: 12 }]}>
              Comments or suggestions for Elix:
            </Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Tell us about the service quality, punctuality, or suggestions…"
              placeholderTextColor={ElixColors.inkMuted}
              multiline
              numberOfLines={3}
              value={feedbackComment}
              onChangeText={setFeedbackComment}
            />
            <Pressable
              style={[styles.feedbackSubmitBtn, isSubmittingFeedback && styles.btnDisabled]}
              onPress={handleSubmitOverallFeedback}
              disabled={isSubmittingFeedback}
            >
              {isSubmittingFeedback ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.feedbackSubmitBtnText}>
                  {feedbackSaved || activeBooking.feedback_comment ? 'Update Feedback' : 'Submit Feedback'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* PAYMENT & FINANCIAL SUMMARY */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>PAYMENT SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>Rs.{activeBooking.subtotal.toFixed(0)}</Text>
          </View>
          {Boolean(activeBooking.discount_amount > 0) ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Discount {activeBooking.coupon_code ? `(${activeBooking.coupon_code})` : ''}
              </Text>
              <Text style={[styles.summaryValue, { color: ElixColors.green }]}>
                -Rs.{activeBooking.discount_amount.toFixed(0)}
              </Text>
            </View>
          ) : null}
          {Boolean(activeBooking.booking_type === 'urgent') ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Express Priority Fee</Text>
              <Text style={[styles.summaryValue, { color: ElixColors.blue }]}>+Rs.99</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total Amount</Text>
            <Text style={styles.summaryTotalValue}>Rs.{activeBooking.total_amount.toFixed(0)}</Text>
          </View>

          <View style={styles.paymentMethodNotice}>
            <Ionicons
              name={activeBooking.payment_status === 'paid' ? 'checkmark-circle' : 'cash-outline'}
              size={18}
              color={activeBooking.payment_status === 'paid' ? ElixColors.green : '#B45309'}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.paymentMethodNoticeTitle}>
                {activeBooking.payment_status === 'paid'
                  ? 'Paid Online via Razorpay'
                  : 'Payment at Home (Cash or UPI)'}
              </Text>
              <Text style={styles.paymentMethodNoticeSub}>
                {activeBooking.payment_status === 'paid'
                  ? 'Payment confirmed and receipt generated.'
                  : `Please pay Rs.${activeBooking.total_amount.toFixed(0)} to your beautician after service.`}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        {/* Invoice button: always available */}
        <Pressable style={styles.barActionBtn} onPress={handleDownloadPdf}>
          <Ionicons name="receipt-outline" size={15} color={ElixColors.blue} />
          <Text style={styles.barActionBtnText}>Receipt PDF</Text>
        </Pressable>

        {/* Reschedule button: removed once on the way */}
        {Boolean(canRescheduleAndCancel) ? (
          <Pressable style={styles.barActionBtn} onPress={openReschedule}>
            <Ionicons name="calendar-outline" size={15} color={ElixColors.blue} />
            <Text style={styles.barActionBtnText}>Reschedule</Text>
          </Pressable>
        ) : null}

        {/* Cancel button: removed once on the way */}
        {Boolean(canRescheduleAndCancel) ? (
          <Pressable
            style={[styles.barActionBtn, styles.barCancelBtn]}
            onPress={() => setShowCancelModal(true)}
          >
            <Ionicons name="close-outline" size={15} color="#DC2626" />
            <Text style={[styles.barActionBtnText, { color: '#DC2626' }]}>Cancel</Text>
          </Pressable>
        ) : null}

        {/* Call Beautician: appears once beautician is assigned */}
        {Boolean(showCallBeautician) ? (
          <Pressable
            style={styles.barActionBtn}
            onPress={() => {
              if (activeBooking.assigned_beautician?.phone) {
                Linking.openURL(`tel:${activeBooking.assigned_beautician.phone}`);
              } else {
                handleHelp();
              }
            }}
          >
            <Ionicons name="call-outline" size={15} color={ElixColors.blue} />
            <Text style={styles.barActionBtnText}>Call Beautician</Text>
          </Pressable>
        ) : null}

        {/* Rebook & Help for completed/cancelled bookings */}
        {Boolean(isCompleted || isCancelled) ? (
          <>
            <Pressable style={styles.barActionBtn} onPress={handleRebook}>
              <Ionicons name="repeat-outline" size={15} color={ElixColors.blue} />
              <Text style={styles.barActionBtnText}>Rebook</Text>
            </Pressable>
            <Pressable style={styles.barActionBtn} onPress={handleHelp}>
              <Ionicons name="help-circle-outline" size={15} color={ElixColors.blue} />
              <Text style={styles.barActionBtnText}>Help</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* CANCELLATION MODAL */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isCancelling && setShowCancelModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isCancelling && setShowCancelModal(false)}
        >
          <Pressable style={styles.confirmModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.warningIconCircle}>
              <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Cancel Booking?</Text>
            <Text style={styles.confirmSubtitle}>
              Are you sure you want to cancel booking #{activeBooking.booking_number}?
              {'\n'}Free cancellation is available anytime before departure.
            </Text>
            <View style={styles.confirmBtnRow}>
              <Pressable
                style={styles.keepBtn}
                onPress={() => setShowCancelModal(false)}
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

      {/* RESCHEDULE MODAL */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => !isRescheduling && setShowRescheduleModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isRescheduling && setShowRescheduleModal(false)}
        >
          <Pressable style={styles.rescheduleModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Reschedule Booking</Text>
                <Text style={styles.modalSub}>#{activeBooking.booking_number}</Text>
              </View>
              <Pressable onPress={() => setShowRescheduleModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={ElixColors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              <Text style={styles.sectionHeading}>1. SELECT NEW DATE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
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

              <Text style={[styles.sectionHeading, { marginTop: 16 }]}>2. APPOINTMENT TYPE</Text>
              <View style={styles.typeToggleRow}>
                <Pressable
                  style={[styles.typeOptionCard, rescheduleType === 'regular' && styles.typeOptionCardActive]}
                  onPress={() => setRescheduleType('regular')}
                >
                  <Ionicons
                    name="calendar"
                    size={16}
                    color={rescheduleType === 'regular' ? ElixColors.blue : ElixColors.inkMuted}
                  />
                  <View style={{ marginLeft: 6, flex: 1 }}>
                    <Text style={[styles.typeOptionTitle, rescheduleType === 'regular' && styles.typeOptionTitleActive]}>
                      Regular Slots
                    </Text>
                    <Text style={styles.typeOptionSub}>Free standard</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.typeOptionCard, rescheduleType === 'urgent' && styles.typeOptionCardActive]}
                  onPress={() => setRescheduleType('urgent')}
                >
                  <Ionicons
                    name="flash"
                    size={16}
                    color={rescheduleType === 'urgent' ? ElixColors.blue : ElixColors.inkMuted}
                  />
                  <View style={{ marginLeft: 6, flex: 1 }}>
                    <Text style={[styles.typeOptionTitle, rescheduleType === 'urgent' && styles.typeOptionTitleActive]}>
                      Express (+₹99)
                    </Text>
                    <Text style={styles.typeOptionSub}>50-min notice</Text>
                  </View>
                </Pressable>
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 16 }]}>
                {rescheduleType === 'regular' ? '3. SELECT TIME SLOT' : '3. EXACT ARRIVAL TIME'}
              </Text>

              {rescheduleType === 'regular' ? (
                <View style={{ gap: 8 }}>
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
                          size={16}
                          color={isSelected ? ElixColors.blue : ElixColors.inkMuted}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.slotCardLabel, isSelected && styles.slotCardLabelActive]}>
                            {slot.label}
                          </Text>
                          <Text style={styles.slotCardTime}>{slot.time}</Text>
                        </View>
                        {Boolean(isSelected) ? (
                          <Ionicons name="checkmark-circle" size={16} color={ElixColors.blue} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                >
                  {expressTimes.map((timeStr) => {
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
                  })}
                </ScrollView>
              )}
            </ScrollView>

            <View style={{ gap: 8, marginTop: 16 }}>
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
                onPress={() => setShowRescheduleModal(false)}
                disabled={isRescheduling}
              >
                <Text style={styles.cancelRescheduleBtnText}>Keep Current Slot</Text>
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: ElixColors.inkMuted },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginTop: 12 },
  errorSub: { fontSize: 13, color: ElixColors.inkMuted, marginTop: 4, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: ElixColors.blue, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 4 },
  navTitle: { fontSize: 16, fontWeight: '800', color: ElixColors.ink },
  navSub: { fontSize: 11, color: ElixColors.inkMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  scrollArea: { flex: 1, padding: 16 },

  // OTP Card
  otpCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  otpHeader: { flexDirection: 'row', alignItems: 'center' },
  otpHeaderTitle: { fontSize: 14, fontWeight: '800', color: '#065F46' },
  otpHeaderSub: { fontSize: 12, color: '#047857', marginTop: 2 },
  otpNumberBox: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginTop: 12,
  },
  otpDigits: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },

  // Base card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ElixRadii.lg,
    padding: 16,
    ...ElixShadows.sm,
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: ElixColors.inkMuted,
    letterSpacing: 0.6,
    marginBottom: 12,
  },

  // Timeline
  timelineList: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', minHeight: 48 },
  timelineIconCol: { alignItems: 'center', width: 28 },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCircleDone: { backgroundColor: ElixColors.greenDeep },
  timelineCircleActive: { backgroundColor: ElixColors.blue },
  timelineCircleCancelled: { backgroundColor: '#DC2626' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: 3 },
  timelineLineDone: { backgroundColor: ElixColors.greenDeep },
  timelineTextCol: { flex: 1, marginLeft: 10, paddingBottom: 14 },
  timelineStepTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  timelineStepDesc: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 1 },

  // Beautician Card
  beauticianCardBody: { flexDirection: 'row', alignItems: 'center' },
  beauticianPhoto: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0' },
  beauticianPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beauticianName: { fontSize: 14, fontWeight: '800', color: ElixColors.ink },
  beauticianRole: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 1 },
  beauticianRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  beauticianRatingText: { fontSize: 11, fontWeight: '700', color: ElixColors.ink },
  callBeauticianBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callBeauticianBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  // Info
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: ElixColors.inkMuted, textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: ElixColors.ink, fontWeight: '600', marginTop: 2, lineHeight: 18 },

  // Service item
  serviceItemCard: {},
  serviceItemHead: { flexDirection: 'row', justifyContent: 'space-between' },
  serviceItemName: { fontSize: 13, fontWeight: '700', color: ElixColors.ink, flex: 1 },
  serviceItemPrice: { fontSize: 13, fontWeight: '800', color: ElixColors.ink },
  serviceIncludedBox: { marginTop: 4, paddingLeft: 6 },
  serviceIncludedText: { fontSize: 11, color: ElixColors.inkMuted, lineHeight: 16 },

  // Ratings
  itemRatingSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemRatingPrompt: { fontSize: 11, fontWeight: '600', color: ElixColors.inkMuted },
  starPickerRow: { flexDirection: 'row', gap: 6 },
  starBtn: { padding: 2 },
  beauticianFeedbackRating: { marginBottom: 8 },
  feedbackSubLabel: { fontSize: 12, fontWeight: '700', color: ElixColors.ink, marginBottom: 6 },
  feedbackInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: ElixColors.ink,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  feedbackSubmitBtn: {
    backgroundColor: ElixColors.blue,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  feedbackSubmitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  // Financial summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 12, color: ElixColors.inkMuted },
  summaryValue: { fontSize: 12, fontWeight: '600', color: ElixColors.ink },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6, marginTop: 4 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '800', color: ElixColors.ink },
  summaryTotalValue: { fontSize: 16, fontWeight: '900', color: ElixColors.blue },
  paymentMethodNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentMethodNoticeTitle: { fontSize: 12, fontWeight: '700', color: ElixColors.ink },
  paymentMethodNoticeSub: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 1 },

  // Bottom action bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    ...ElixShadows.md,
  },
  barActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  barCancelBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  barActionBtnText: { fontSize: 12, fontWeight: '700', color: ElixColors.blue },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' },
  confirmModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center' },
  warningIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginBottom: 6 },
  confirmSubtitle: { fontSize: 13, color: ElixColors.inkMuted, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  confirmBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  keepBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  keepBtnText: { fontSize: 13, fontWeight: '700', color: ElixColors.ink },
  confirmCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  confirmCancelBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },

  rescheduleModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: '90%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 10 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: ElixColors.ink },
  modalSub: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 1 },
  sectionHeading: { fontSize: 10, fontWeight: '800', color: ElixColors.inkMuted, letterSpacing: 0.5, marginBottom: 6 },
  dateCard: { width: 56, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  dateCardActive: { backgroundColor: ElixColors.blue, borderColor: ElixColors.blue },
  dateCardDay: { fontSize: 10, fontWeight: '600', color: ElixColors.inkMuted },
  dateCardDayActive: { color: '#FFFFFF' },
  dateCardNum: { fontSize: 15, fontWeight: '800', color: ElixColors.ink, marginVertical: 1 },
  dateCardNumActive: { color: '#FFFFFF' },
  dateCardMonth: { fontSize: 9, fontWeight: '600', color: ElixColors.inkMuted },
  dateCardMonthActive: { color: '#FFFFFF' },
  typeToggleRow: { flexDirection: 'row', gap: 8 },
  typeOptionCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  typeOptionCardActive: { backgroundColor: '#EFF6FF', borderColor: ElixColors.blue },
  typeOptionTitle: { fontSize: 11, fontWeight: '700', color: ElixColors.ink },
  typeOptionTitleActive: { color: ElixColors.blue },
  typeOptionSub: { fontSize: 9, color: ElixColors.inkMuted },
  slotCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  slotCardActive: { backgroundColor: '#EFF6FF', borderColor: ElixColors.blue },
  slotCardLabel: { fontSize: 12, fontWeight: '700', color: ElixColors.ink },
  slotCardLabelActive: { color: ElixColors.blue },
  slotCardTime: { fontSize: 10, color: ElixColors.inkMuted },
  timeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  timeChipActive: { backgroundColor: ElixColors.blue, borderColor: ElixColors.blue },
  timeChipText: { fontSize: 11, fontWeight: '700', color: ElixColors.ink },
  timeChipTextActive: { color: '#FFFFFF' },
  confirmRescheduleBtn: { backgroundColor: ElixColors.blue, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  confirmRescheduleBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  cancelRescheduleBtn: { paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#F3F4F6' },
  cancelRescheduleBtnText: { fontSize: 12, fontWeight: '600', color: ElixColors.inkMuted },

  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  toastBannerText: { fontSize: 12, fontWeight: '600', color: '#166534' },
});
