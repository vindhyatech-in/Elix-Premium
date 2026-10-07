import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function StepDate({ onNext }: { onNext: () => void }) {
  const { selectedDate, setDate } = useBookingFlowStore();

  const today = useMemo(() => new Date(), []);

  // Build 21-day window starting from today
  const days = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => addDays(today, i));
  }, [today]);

  // Group by week for a calendar-grid feel
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let week: Date[] = [];
    days.forEach((d, i) => {
      week.push(d);
      if (week.length === 7 || i === days.length - 1) {
        result.push(week);
        week = [];
      }
    });
    return result;
  }, [days]);

  const canProceed = !!selectedDate;

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>When should the artist arrive?</Text>
      <Text style={styles.stepSubtitle}>Select a date (next 21 days)</Text>

      {/* Day-of-week header */}
      <View style={styles.dowRow}>
        {DAYS_SHORT.map((d) => (
          <Text key={d} style={styles.dowText}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.calScroll}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day) => {
              const ymd = toYMD(day);
              const isToday = toYMD(today) === ymd;
              const selected = selectedDate === ymd;
              const isPast = day < today && !isToday;
              return (
                <Pressable
                  key={ymd}
                  style={[
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    isToday && !selected && styles.dayCellToday,
                  ]}
                  onPress={() => !isPast && setDate(ymd)}
                  disabled={isPast}
                >
                  <Text style={[
                    styles.dayNum,
                    selected && styles.dayNumSelected,
                    isPast && styles.dayNumPast,
                    isToday && !selected && styles.dayNumToday,
                  ]}>
                    {day.getDate()}
                  </Text>
                  {isToday && (
                    <Text style={[styles.todayDot, selected && { color: '#fff' }]}>today</Text>
                  )}
                </Pressable>
              );
            })}
            {/* Pad last week */}
            {week.length < 7 && Array.from({ length: 7 - week.length }, (_, i) => (
              <View key={`pad-${i}`} style={styles.dayCell} />
            ))}
          </View>
        ))}

        {/* Selected date display */}
        {selectedDate && (
          <View style={styles.selectedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={ElixColors.green} />
            <Text style={styles.selectedBannerText}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
        onPress={canProceed ? onNext : undefined}
      >
        <Text style={styles.nextBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: ElixColors.inkMuted, marginBottom: 12 },
  dowRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  dowText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: ElixColors.inkMuted },
  calScroll: { flex: 1 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayCell: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dayCellSelected: { backgroundColor: ElixColors.blue },
  dayCellToday: { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: ElixColors.blue },
  dayNum: { fontSize: 14, fontWeight: '600', color: ElixColors.ink },
  dayNumSelected: { color: '#fff', fontWeight: '800' },
  dayNumPast: { color: '#D1D5DB' },
  dayNumToday: { color: ElixColors.blue, fontWeight: '800' },
  todayDot: { fontSize: 8, color: ElixColors.blue, fontWeight: '700', marginTop: 1 },
  selectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#D1FAE5', borderRadius: ElixRadii.md,
    padding: 12, marginTop: 8,
  },
  selectedBannerText: { fontSize: 13, fontWeight: '600', color: '#065F46', flex: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ElixColors.blue, borderRadius: ElixRadii.lg, paddingVertical: 14, marginTop: 12, marginBottom: 8 },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
