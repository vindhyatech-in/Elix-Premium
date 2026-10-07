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

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.post('/bookings/checkout/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
}
