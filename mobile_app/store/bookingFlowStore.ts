import { create } from 'zustand';
import type { Address } from '../types/api';

export type BookingStep = 1 | 2 | 3 | 4 | 5;
export type BookingType = 'regular' | 'urgent';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export type PaymentMethod = 'pay_at_home' | 'pay_now';

export interface BookingFlowState {
  step: BookingStep;
  // Step 1 — Address
  selectedAddress: Address | null;
  newAddressText: string;
  newAddressLabel: string;
  newAddressPincode: string;
  // Step 2 — Date
  selectedDate: string | null;   // ISO string yyyy-MM-dd
  // Step 3 — Type + slot
  bookingType: BookingType;
  timeSlot: TimeSlot | null;     // for regular
  exactTime: string | null;      // HH:MM for urgent
  couponCode: string;
  couponApplied: boolean;
  discountPct: number;
  // Step 4 — Payment
  paymentMethod: PaymentMethod;
  // Step 5 — submitted
  isSubmitting: boolean;
  submittedBookingNumber: string | null;
  // Actions
  setStep: (step: BookingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setAddress: (address: Address | null) => void;
  setDate: (date: string) => void;
  setBookingType: (type: BookingType) => void;
  setTimeSlot: (slot: TimeSlot) => void;
  setExactTime: (time: string) => void;
  setCoupon: (code: string, pct: number) => void;
  clearCoupon: () => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setSubmitting: (v: boolean) => void;
  setSubmittedBookingNumber: (n: string) => void;
  reset: () => void;
}

const INITIAL: Omit<BookingFlowState,
  'setStep' | 'nextStep' | 'prevStep' | 'setAddress' | 'setDate' | 'setBookingType' |
  'setTimeSlot' | 'setExactTime' | 'setCoupon' | 'clearCoupon' | 'setPaymentMethod' |
  'setSubmitting' | 'setSubmittedBookingNumber' | 'reset'
> = {
  step: 1,
  selectedAddress: null,
  newAddressText: '',
  newAddressLabel: '',
  newAddressPincode: '',
  selectedDate: null,
  bookingType: 'regular',
  timeSlot: null,
  exactTime: null,
  couponCode: '',
  couponApplied: false,
  discountPct: 0,
  paymentMethod: 'pay_at_home',
  isSubmitting: false,
  submittedBookingNumber: null,
};

export const useBookingFlowStore = create<BookingFlowState>((set, get) => ({
  ...INITIAL,
  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(5, s.step + 1) as BookingStep })),
  prevStep: () => set((s) => ({ step: Math.max(1, s.step - 1) as BookingStep })),
  setAddress: (address) => set({ selectedAddress: address }),
  setDate: (date) => set({ selectedDate: date }),
  setBookingType: (bookingType) => set({ bookingType, timeSlot: null, exactTime: null }),
  setTimeSlot: (timeSlot) => set({ timeSlot }),
  setExactTime: (exactTime) => set({ exactTime }),
  setCoupon: (code, pct) => set({ couponCode: code, discountPct: pct, couponApplied: true }),
  clearCoupon: () => set({ couponCode: '', discountPct: 0, couponApplied: false }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setSubmittedBookingNumber: (n) => set({ submittedBookingNumber: n }),
  reset: () => set({ ...INITIAL }),
}));
