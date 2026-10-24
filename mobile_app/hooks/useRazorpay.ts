import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

/**
 * useRazorpayOrder — creates a Razorpay order on the backend.
 * Returns { order_id, amount, currency, key_id } from Django.
 */
export function useRazorpayOrder() {
  return useMutation({
    mutationFn: (payload: { amount_paise: number; receipt: string }) =>
      apiClient.post('/payments/razorpay/create-order/', payload),
  });
}

/**
 * useRazorpayVerify — after SDK fires success callback, verifies
 * the signature server-side and creates the Booking.
 */
export function useRazorpayVerify() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.post('/payments/razorpay/verify/', payload),
  });
}
