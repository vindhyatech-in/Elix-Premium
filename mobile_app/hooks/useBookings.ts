import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Booking } from '../types/api';

export function useBookings(enabled = true) {
  return useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      const res = await apiClient.get('/bookings/');
      return (res.data.bookings ?? []) as Booking[];
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingNumber: string) =>
      apiClient.post(`/bookings/${bookingNumber}/cancel/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

export function useRescheduleBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      bookingNumber: string;
      date: string;
      booking_type: 'regular' | 'urgent';
      time_slot?: string;
      exact_time?: string;
    }) =>
      apiClient.post(`/bookings/${params.bookingNumber}/reschedule/`, {
        date: params.date,
        booking_type: params.booking_type,
        time_slot: params.time_slot,
        exact_time: params.exact_time,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}

export function useBookingDetail(bookingNumber: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const cleanNumber = bookingNumber ? bookingNumber.replace(/^#/, '').trim() : '';

  return useQuery<Booking>({
    queryKey: ['booking', cleanNumber],
    queryFn: async () => {
      if (!cleanNumber) throw new Error('No booking number');

      // 1. Check existing React Query cache first
      const cachedList = qc.getQueryData<Booking[]>(['bookings']);
      const fromCache = cachedList?.find(
        (b) => b.booking_number.replace(/^#/, '').trim() === cleanNumber
      );

      // 2. Try dedicated detail endpoint
      try {
        const res = await apiClient.get(`/bookings/${cleanNumber}/detail/`);
        if (res.data?.booking) return res.data.booking as Booking;
      } catch (err) {
        // If 404 or backend route not deployed on live server yet, fall back gracefully
        if (fromCache) return fromCache;
      }

      // 3. Fallback: fetch /bookings/ list if cache wasn't populated yet
      try {
        const listRes = await apiClient.get('/bookings/');
        const freshList = (listRes.data?.bookings ?? []) as Booking[];
        const found = freshList.find(
          (b) => b.booking_number.replace(/^#/, '').trim() === cleanNumber
        );
        if (found) return found;
      } catch (e) {
        if (fromCache) return fromCache;
        throw e;
      }

      if (fromCache) return fromCache;
      throw new Error(`Booking #${cleanNumber} not found.`);
    },
    initialData: () => {
      if (!cleanNumber) return undefined;
      const cachedList = qc.getQueryData<Booking[]>(['bookings']);
      return cachedList?.find(
        (b) => b.booking_number.replace(/^#/, '').trim() === cleanNumber
      );
    },
    enabled: enabled && !!cleanNumber,
    staleTime: 60 * 1000,
  });
}

export function useSubmitItemReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      itemId: number;
      rating?: number;
      beautician_rating?: number;
    }) =>
      apiClient.post(`/bookings/items/${params.itemId}/review/`, {
        rating: params.rating,
        beautician_rating: params.beautician_rating,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      bookingNumber: string;
      comment: string;
    }) =>
      apiClient.post(`/bookings/${params.bookingNumber}/feedback/`, {
        comment: params.comment,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.post('/bookings/checkout/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}
