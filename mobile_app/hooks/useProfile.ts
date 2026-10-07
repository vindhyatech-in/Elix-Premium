import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Profile, Address } from '../types/api';

export function useProfile(enabled = true) {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await apiClient.get('/profile/');
      return res.data as Profile;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddresses(enabled = true) {
  return useQuery<Address[]>({
    queryKey: ['addresses'],
    queryFn: async () => {
      const res = await apiClient.get('/addresses/');
      return (res.data.addresses ?? []) as Address[];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<Address, 'id'>) =>
      apiClient.post('/addresses/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/addresses/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { first_name: string; last_name: string; phone: string }) =>
      apiClient.post('/profile/', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}
