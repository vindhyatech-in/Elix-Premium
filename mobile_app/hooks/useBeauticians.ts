import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Beautician } from '../types/api';

export function useBeauticians() {
  return useQuery<Beautician[]>({
    queryKey: ['beauticians'],
    queryFn: async () => {
      const res = await apiClient.get('/beauticians/');
      return (res.data?.beauticians || []) as Beautician[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
