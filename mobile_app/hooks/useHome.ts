import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { HomeData } from '../types/api';

export function useHome() {
  return useQuery<HomeData>({
    queryKey: ['home'],
    queryFn: async () => {
      const res = await apiClient.get('/home/');
      return res.data as HomeData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — marketing data doesn't change often
  });
}
