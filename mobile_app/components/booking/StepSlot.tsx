import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import type { TimeSlot, BookingType } from '@/store/bookingFlowStore';
import { toYMD } from './StepDate';

interface RegularSlotDef {
  key: TimeSlot;
  label: string;
  time: string;
  icon: string;
  endHour: number;
  endMinute: number;
}

const REGULAR_SLOTS: RegularSlotDef[] = [
  { key: 'morning',   label: 'Morning',   time: '7 AM – 12 PM',  icon: 'sunny-outline',        endHour: 12, endMinute: 0 },
  { key: 'afternoon', label: 'Afternoon', time: '12 PM – 4 PM',  icon: 'partly-sunny-outline', endHour: 16, endMinute: 0 },
  { key: 'evening',   label: 'Evening',   time: '4 PM – 8 PM',   icon: 'moon-outline',         endHour: 20, endMinute: 0 },
];

/** Generate urgent slots: start from now + 50 min, round up to next 15-min mark, 6-8 slots */
function getUrgentSlots(selectedDate: string | null): { time: string; label: string }[] {
  const now = new Date();
  const today = toYMD(now);
  const isToday = !selectedDate || selectedDate === today;

  let start = new Date(now.getTime() + 50 * 60 * 1000);
  // Round up to next 15-min slot
  const mins = start.getMinutes();
  const roundUp = Math.ceil(mins / 15) * 15;
  start.setMinutes(roundUp, 0, 0);

  const slots = [];
  let cursor = isToday ? start : new Date((selectedDate || today) + 'T07:00:00');
  for (let i = 0; i < 8; i++) {
    const h = cursor.getHours();
    const m = cursor.getMinutes();
    if (h >= 20) break; // no slots after 8 PM
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const suffix = h < 12 ? 'AM' : 'PM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push({ time: `${hh}:${mm}`, label: `${h12}:${mm} ${suffix}` });
    cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
  }
  return slots;
}

export function StepSlot({ onNext }: { onNext: () => void }) {
  const {
    bookingType, setBookingType,
    timeSlot, setTimeSlot,
    exactTime, setExactTime,
    selectedDate, setDate,
  } = useBookingFlowStore();

  const urgentSlots = useMemo(() => getUrgentSlots(selectedDate), [selectedDate]);

  // Filter out time slots that have already passed when booking for same day
  const availableRegularSlots = useMemo(() => {
    const now = new Date();
    const todayStr = toYMD(now);
    const isToday = !selectedDate || selectedDate === todayStr;

    if (!isToday) {
      if (selectedDate && selectedDate < todayStr) return [];
      return REGULAR_SLOTS;
    }

    // For same-day bookings, hide time slots whose interval has already passed
    // Align with backend lead-time buffer (min_allowed_time = now + 50 mins)
    const minMins = now.getHours() * 60 + now.getMinutes() + 50;

    return REGULAR_SLOTS.filter((slot) => {
      const slotEndMins = slot.endHour * 60 + slot.endMinute;
      return minMins < slotEndMins;
    });
  }, [selectedDate]);

  // If a previously selected slot has passed / is no longer available today, clear selection
  useEffect(() => {
    if (bookingType === 'regular' && timeSlot) {
      const isStillAvailable = availableRegularSlots.some((s) => s.key === timeSlot);
      if (!isStillAvailable) {
        setTimeSlot(null);
      }
    }
  }, [availableRegularSlots, timeSlot, bookingType, setTimeSlot]);

  // Quick switch to tomorrow if all today slots have ended
  const handlePickTomorrow = () => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    setDate(toYMD(tmrw));
  };

  const canProceed = bookingType === 'regular'
    ? (!!timeSlot && availableRegularSlots.some((s) => s.key === timeSlot))
    : (!!exactTime && urgentSlots.some((s) => s.time === exactTime));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Choose booking type</Text>
      <Text style={styles.stepSubtitle}>Regular scheduling or express 50-min arrival</Text>

      {/* Type toggle */}
      <View style={styles.typeToggle}>
        {([
          { key: 'regular' as BookingType, label: 'Regular', sub: 'Choose a time slot', icon: 'calendar-outline' },
          { key: 'urgent' as BookingType,  label: 'Express', sub: '50-min arrival', icon: 'flash', urgent: true },
        ] as const).map((t) => (
          <Pressable
            key={t.key}
            style={[styles.typeCard, bookingType === t.key && ((t.key === 'urgent') ? styles.typeCardUrgentActive : styles.typeCardActive)]}
            onPress={() => setBookingType(t.key)}
          >
            <View style={[styles.typeIcon, (t.key === 'urgent') && { backgroundColor: ElixColors.blueLight }]}>
              <Ionicons name={t.icon as any} size={22} color={(t.key === 'urgent') ? ElixColors.urgentRed : ElixColors.blue} />
            </View>
            <Text style={[styles.typeLabel, bookingType === t.key && !(t.key === 'urgent') && { color: ElixColors.blue }, bookingType === t.key && (t.key === 'urgent') && { color: ElixColors.urgentRed }]}>{t.label}</Text>
            <Text style={styles.typeSub}>{t.sub}</Text>
            {(t.key === 'urgent') && (
              <View style={styles.urgentFeeTag}>
                <Text style={styles.urgentFeeText}>+Rs.99</Text>
              </View>
            )}
            <View style={[styles.typeRadio, bookingType === t.key && ((t.key === 'urgent') ? styles.typeRadioUrgent : styles.typeRadioActive)]}>
              {bookingType === t.key && <View style={styles.typeRadioInner} />}
            </View>
          </Pressable>
        ))}
      </View>

      {/* Regular slots */}
      {bookingType === 'regular' && (
        <View style={styles.slotsSection}>
          <Text style={styles.slotSectionTitle}>Select Time Slot</Text>
          {availableRegularSlots.length > 0 ? (
            availableRegularSlots.map((slot) => (
              <Pressable
                key={slot.key}
                style={[styles.slotRow, timeSlot === slot.key && styles.slotRowSelected]}
                onPress={() => setTimeSlot(slot.key)}
              >
                <View style={[styles.slotIcon, timeSlot === slot.key && { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name={slot.icon as any} size={20} color={timeSlot === slot.key ? ElixColors.blue : ElixColors.inkMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.slotLabel, timeSlot === slot.key && { color: ElixColors.blue }]}>{slot.label}</Text>
                  <Text style={styles.slotTime}>{slot.time}</Text>
                </View>
                <View style={[styles.slotRadio, timeSlot === slot.key && styles.slotRadioActive]}>
                  {timeSlot === slot.key && <View style={styles.slotRadioInner} />}
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.noSlotsCard}>
              <View style={styles.noSlotsIconWrap}>
                <Ionicons name="time-outline" size={24} color={ElixColors.blue} />
              </View>
              <Text style={styles.noSlotsTitle}>All regular slots ended for today</Text>
              <Text style={styles.noSlotsSub}>
                Regular time slots for today have already passed. You can schedule for tomorrow or choose Express arrival.
              </Text>
              <View style={styles.noSlotsActions}>
                <Pressable style={styles.noSlotsBtnOutline} onPress={handlePickTomorrow}>
                  <Ionicons name="calendar-outline" size={15} color={ElixColors.blue} />
                  <Text style={styles.noSlotsBtnOutlineText}>Book Tomorrow</Text>
                </Pressable>
                {urgentSlots.length > 0 && (
                  <Pressable style={styles.noSlotsBtnPrimary} onPress={() => setBookingType('urgent')}>
                    <Ionicons name="flash" size={15} color="#fff" />
                    <Text style={styles.noSlotsBtnPrimaryText}>Express Arrival</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Urgent slots */}
      {bookingType === 'urgent' && (
        <View style={styles.slotsSection}>
          <View style={styles.urgentBanner}>
            <Ionicons name="flash" size={14} color={ElixColors.blue} />
            <Text style={styles.urgentBannerText}>Artist arrives within 50 minutes · Rs.99 express fee · Rs.50 rush bonus to artist</Text>
          </View>
          <Text style={styles.slotSectionTitle}>Select Arrival Time</Text>
          {urgentSlots.length > 0 ? (
            <View style={styles.urgentGrid}>
              {urgentSlots.map((slot) => (
                <Pressable
                  key={slot.time}
                  style={[styles.urgentSlotBtn, exactTime === slot.time && styles.urgentSlotBtnActive]}
                  onPress={() => setExactTime(slot.time)}
                >
                  <Text style={[styles.urgentSlotText, exactTime === slot.time && styles.urgentSlotTextActive]}>{slot.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.noSlotsCard}>
              <View style={styles.noSlotsIconWrap}>
                <Ionicons name="moon-outline" size={24} color={ElixColors.inkMuted} />
              </View>
              <Text style={styles.noSlotsTitle}>No express slots left for today</Text>
              <Text style={styles.noSlotsSub}>
                Express bookings close at 7:15 PM for same-day service. Please select tomorrow to schedule.
              </Text>
              <View style={styles.noSlotsActions}>
                <Pressable style={styles.noSlotsBtnOutline} onPress={handlePickTomorrow}>
                  <Ionicons name="calendar-outline" size={15} color={ElixColors.blue} />
                  <Text style={styles.noSlotsBtnOutlineText}>Book Tomorrow</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      <Pressable
        style={[styles.nextBtn, bookingType === 'urgent' ? styles.nextBtnUrgent : {}, !canProceed && styles.nextBtnDisabled]}
        onPress={canProceed ? onNext : undefined}
      >
        <Text style={styles.nextBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: ElixColors.inkMuted, marginBottom: 16 },
  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeCard: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: ElixRadii.lg, padding: 14, alignItems: 'center', gap: 4 },
  typeCardActive: { borderColor: ElixColors.blue, backgroundColor: '#EFF6FF' },
  typeCardUrgentActive: { borderColor: ElixColors.blue, backgroundColor: ElixColors.blueLight },
  typeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  typeLabel: { fontSize: 14, fontWeight: '700', color: ElixColors.ink },
  typeSub: { fontSize: 11, color: ElixColors.inkMuted, textAlign: 'center' },
  urgentFeeTag: { backgroundColor: ElixColors.blueLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 2 },
  urgentFeeText: { fontSize: 10, fontWeight: '800', color: ElixColors.blue },
  typeRadio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  typeRadioActive: { borderColor: ElixColors.blue },
  typeRadioUrgent: { borderColor: ElixColors.blue },
  typeRadioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: ElixColors.blue },
  slotsSection: { marginBottom: 16 },
  slotSectionTitle: { fontSize: 14, fontWeight: '700', color: ElixColors.ink, marginBottom: 10 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: ElixRadii.md, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: ElixColors.white, marginBottom: 8 },
  slotRowSelected: { borderColor: ElixColors.blue, backgroundColor: '#EFF6FF' },
  slotIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  slotLabel: { fontSize: 14, fontWeight: '700', color: ElixColors.ink },
  slotTime: { fontSize: 12, color: ElixColors.inkMuted, marginTop: 1 },
  slotRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  slotRadioActive: { borderColor: ElixColors.blue },
  slotRadioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: ElixColors.blue },
  urgentBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: ElixColors.blueLight, borderRadius: ElixRadii.md, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  urgentBannerText: { fontSize: 12, color: ElixColors.blueDeep, flex: 1, lineHeight: 16 },
  urgentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urgentSlotBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: ElixRadii.md, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: ElixColors.white },
  urgentSlotBtnActive: { borderColor: ElixColors.blue, backgroundColor: ElixColors.blueLight },
  urgentSlotText: { fontSize: 13, fontWeight: '600', color: ElixColors.inkMuted },
  urgentSlotTextActive: { color: ElixColors.blue, fontWeight: '800' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ElixColors.blue, borderRadius: ElixRadii.lg, paddingVertical: 14, marginTop: 8 },
  nextBtnUrgent: { backgroundColor: ElixColors.blue },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  noSlotsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: ElixRadii.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  noSlotsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  noSlotsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ElixColors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  noSlotsSub: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  noSlotsActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  noSlotsBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: ElixRadii.md,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    backgroundColor: '#fff',
  },
  noSlotsBtnOutlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.blue,
  },
  noSlotsBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: ElixRadii.md,
    backgroundColor: ElixColors.blue,
  },
  noSlotsBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
