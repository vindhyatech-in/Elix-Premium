import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface Offer {
  code: string;
  title: string;
  description: string;
}

export function useOffers() {
  return useQuery<Offer[]>({
    queryKey: ['offers'],
    queryFn: async () => {
      const res = await apiClient.get('/offers/');
      return (res.data?.offers ?? []) as Offer[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
