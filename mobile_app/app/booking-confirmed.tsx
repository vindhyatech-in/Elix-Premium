import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ElixColors, ElixRadii } from '@/constants/theme';

/**
 * app/booking-confirmed.tsx
 *
 * Shown after a successful checkout (both Pay at Home and Pay Now paths).
 * Receives `booking_number` and `payment_method` via router query params.
 * Animates in with a scale + fade on the checkmark badge.
 */
export default function BookingConfirmedScreen() {
  const params = useLocalSearchParams<{ booking_number: string; payment_method?: string }>();
  const bookingNumber = params.booking_number ?? '';
  const isPaid = params.payment_method === 'razorpay';

  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Animated check badge */}
        <Animated.View style={[styles.checkWrap, { transform: [{ scale }], opacity }]}>
          <View style={styles.checkOuter}>
            <View style={styles.checkInner}>
              <Ionicons name="checkmark" size={52} color="#fff" />
            </View>
          </View>
          {/* Pulse rings */}
          <View style={[styles.ring, styles.ring1]} />
          <View style={[styles.ring, styles.ring2]} />
        </Animated.View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          Your beauty session is booked.{'\n'}We're assigning an artist to your request.
        </Text>

        {/* Booking number card */}
        <View style={styles.bnCard}>
          <Text style={styles.bnLabel}>Booking Number</Text>
          <Text style={styles.bnValue}>#{bookingNumber}</Text>
          {isPaid && (
            <View style={styles.paidBadge}>
              <Ionicons name="card" size={12} color={ElixColors.greenDeep} />
              <Text style={styles.paidBadgeText}>Payment Received</Text>
            </View>
          )}
          {!isPaid && (
            <View style={styles.cahBadge}>
              <Ionicons name="cash-outline" size={12} color={ElixColors.blue} />
              <Text style={styles.cahBadgeText}>Pay at Home when artist arrives</Text>
            </View>
          )}
        </View>

        {/* Info steps */}
        <View style={styles.stepsCard}>
          {[
            { icon: 'person-circle-outline', color: '#4F46E5', text: 'Artist is being assigned to your booking' },
            { icon: 'notifications-outline', color: '#059669', text: 'You will receive a notification once assigned' },
            { icon: 'location-outline', color: ElixColors.blue, text: 'Artist will arrive at your address on schedule' },
          ].map((item, i) => (
            <View key={i} style={[styles.stepRow, i > 0 && styles.stepRowBorder]}>
              <View style={[styles.stepIconWrap, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.stepText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA Buttons */}
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)/bookings')}
        >
          <Ionicons name="receipt-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>View My Bookings</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </Pressable>

        <Text style={styles.helpText}>
          Need help? WhatsApp us at{' '}
          <Text style={{ color: ElixColors.blue, fontWeight: '700' }}>+91 74406 70533</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },

  checkWrap: { position: 'relative', width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  checkOuter: { zIndex: 2 },
  checkInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#059669',
  },
  ring1: { width: 116, height: 116, opacity: 0.25 },
  ring2: { width: 132, height: 132, opacity: 0.12 },

  title: { fontSize: 26, fontWeight: '800', color: ElixColors.ink, textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: ElixColors.inkMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  bnCard: {
    backgroundColor: '#fff',
    borderRadius: ElixRadii.lg,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  bnLabel: { fontSize: 12, fontWeight: '600', color: ElixColors.inkMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  bnValue: { fontSize: 28, fontWeight: '800', color: ElixColors.ink, letterSpacing: -0.5, marginBottom: 10 },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ElixColors.greenLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  paidBadgeText: { fontSize: 12, fontWeight: '700', color: ElixColors.greenDeep },
  cahBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ElixColors.blueLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  cahBadgeText: { fontSize: 12, fontWeight: '700', color: ElixColors.blue },

  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: ElixRadii.lg,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  stepRowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  stepIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 14, color: ElixColors.inkMuted, flex: 1, lineHeight: 20 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ElixColors.blue,
    borderRadius: ElixRadii.lg,
    paddingVertical: 15, paddingHorizontal: 32,
    width: '100%', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: ElixColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: 13,
    width: '100%',
    alignItems: 'center',
    borderRadius: ElixRadii.lg,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: ElixColors.inkMuted },
  helpText: { fontSize: 13, color: ElixColors.inkMuted, textAlign: 'center' },
});
