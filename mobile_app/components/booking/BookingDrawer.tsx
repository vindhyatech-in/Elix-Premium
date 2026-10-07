import React, { useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { StepAddress } from './StepAddress';
import { StepDate } from './StepDate';
import { StepSlot } from './StepSlot';
import { StepPayment } from './StepPayment';
import { StepSummary } from './StepSummary';

/**
 * BookingDrawer — a 5-step booking flow rendered as a full-screen modal
 * panel that slides up from the bottom.
 *
 * Why not @gorhom/bottom-sheet?
 * The library works great on native but requires react-native-reanimated
 * worklets that don't always initialise cleanly on Expo web.  For cross-
 * platform parity we use a simple animated overlay that behaves identically
 * on iOS, Android, and web.  A future native-only branch can swap this
 * for BottomSheet if needed (the step components are already isolated).
 */

interface BookingDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const STEPS = [
  { num: 1, label: 'Address',  icon: 'location-outline' },
  { num: 2, label: 'Date',     icon: 'calendar-outline' },
  { num: 3, label: 'Slot',     icon: 'time-outline' },
  { num: 4, label: 'Payment',  icon: 'card-outline' },
  { num: 5, label: 'Review',   icon: 'checkmark-circle-outline' },
] as const;

export function BookingDrawer({ visible, onClose }: BookingDrawerProps) {
  const { step, setStep, nextStep, prevStep, reset, bookingType } = useBookingFlowStore();

  const isUrgent = bookingType === 'urgent';

  function handleClose() {
    reset();
    onClose();
  }

  if (!visible) return null;

  const accentColor = isUrgent && step >= 3 ? ElixColors.urgentRed : ElixColors.blue;

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Book a Session</Text>
            <Text style={styles.headerSub}>Step {step} of 5 — {STEPS[step - 1].label}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
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

        {/* Back nav (steps 2-4) */}
        {step > 1 && step < 5 && (
          <Pressable style={styles.backBtn} onPress={prevStep}>
            <Ionicons name="arrow-back" size={16} color={ElixColors.inkMuted} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
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
    height: '93%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    overflow: 'hidden',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: ElixColors.ink },
  headerSub: { fontSize: 13, color: ElixColors.inkMuted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 4,
  },
  dotWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dotActive: { backgroundColor: ElixColors.blue, borderColor: 'transparent' },
  dotDone: {},
  dotNum: { fontSize: 10, fontWeight: '700', color: ElixColors.inkMuted },
  dotLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 2 },
  content: { flex: 1, paddingTop: 4 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: ElixColors.inkMuted },
});
