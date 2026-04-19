import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { LeadQualityResponse, LeadQualityFilters } from '../types';

export function useLeadQualityData(filters: LeadQualityFilters) {
  return useQuery({
    queryKey: ['lead-quality', filters],
    queryFn: async (): Promise<LeadQualityResponse> => {
      const params = new URLSearchParams({
        date_from: filters.dateFrom.toISOString(),
        date_to: filters.dateTo.toISOString(),
        group_by: filters.groupBy,
        view: filters.view,
        ...(filters.quality && { quality: filters.quality.join(',') })
      });

      return apiGet(`/analytics/lead-quality?${params}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}