import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { CatalogItem } from '../types/api';

export function useCatalog(kind?: 'service' | 'package') {
  return useQuery<CatalogItem[]>({
    queryKey: ['catalog', kind ?? 'all'],
    queryFn: async () => {
      const params = kind ? { kind } : {};
      const res = await apiClient.get('/catalog/', { params });
      return (res.data.catalog ?? []) as CatalogItem[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
