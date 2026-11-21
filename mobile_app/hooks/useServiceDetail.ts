import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { ServiceDetailData } from '../types/api';

export function useServiceDetail(slug: string | undefined) {
  return useQuery<ServiceDetailData>({
    queryKey: ['service_detail', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');
      const res = await apiClient.get(`/catalog/${slug}/`);
      return res.data.item as ServiceDetailData;
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}
