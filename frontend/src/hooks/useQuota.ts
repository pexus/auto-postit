import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface QuotaUsage {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

export interface PlatformQuota {
  platformId: string;
  platformType: string;
  platformName: string;
  displayName: string;
  daily: QuotaUsage;
  monthly: QuotaUsage;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

export interface QuotaSummary {
  totalDailyPosts: number;
  totalMonthlyPosts: number;
  connectedPlatforms: number;
  platformsNearLimit: number;
  platformsAtLimit: number;
}

export interface QuotaLimits {
  [key: string]: {
    daily: number;
    monthly: number;
    name: string;
  };
}

export interface QuotaResponse {
  platforms: PlatformQuota[];
  summary: QuotaSummary;
  limits: QuotaLimits;
}

export interface QuotaCheckResponse {
  allowed: boolean;
  dailyExceeded: boolean;
  monthlyExceeded: boolean;
  dailyRemaining: number;
  monthlyRemaining: number;
}

export function useQuota() {
  return useQuery<QuotaResponse>({
    queryKey: ['quota'],
    queryFn: async () => {
      const response = await api.get<QuotaResponse>('/api/quota');
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useQuotaCheck(platformType: string) {
  return useQuery<QuotaCheckResponse>({
    queryKey: ['quota', 'check', platformType],
    queryFn: async () => {
      const response = await api.get<QuotaCheckResponse>(`/api/quota/check/${platformType}`);
      return response.data;
    },
    enabled: !!platformType,
  });
}
