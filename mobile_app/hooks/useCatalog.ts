import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { CatalogItem } from '../types/api';

export function useCatalog(kind?: 'service' | 'package') {
  return useQuery<CatalogItem[]>({
    queryKey: ['catalog', kind ?? 'all'],
    queryFn: async () => {
      const params = kind ? { kind } : {};
      const res = await apiClient.get('/catalog/', { params });
      const rawCatalog = (res.data.catalog ?? []) as CatalogItem[];
      return rawCatalog.filter(
        (item) => !item.name.includes('<') && !item.name.toLowerCase().includes('xss')
      );
    },
    staleTime: 2 * 60 * 1000,
  });
}
