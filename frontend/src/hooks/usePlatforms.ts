import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// Types
export type PlatformType = 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'YOUTUBE' | 'PINTEREST';

export interface Platform {
  id: string;
  type: PlatformType;
  name: string;
  platformUserId: string;
  platformUsername: string | null;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformListResponse {
  platforms: Platform[];
}

// Platform character limits and metadata
export const PLATFORM_CONFIG: Record<PlatformType, {
  name: string;
  icon: string;
  maxChars: number;
  supportsImages: boolean;
  supportsVideos: boolean;
  maxImages: number;
  maxVideos: number;
  color: string;
}> = {
  TWITTER: {
    name: 'X (Twitter)',
    icon: '𝕏',
    maxChars: 280,
    supportsImages: true,
    supportsVideos: true,
    maxImages: 4,
    maxVideos: 1,
    color: 'bg-black',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    icon: 'in',
    maxChars: 3000,
    supportsImages: true,
    supportsVideos: true,
    maxImages: 20,
    maxVideos: 1,
    color: 'bg-blue-700',
  },
  FACEBOOK: {
    name: 'Facebook',
    icon: 'f',
    maxChars: 63206,
    supportsImages: true,
    supportsVideos: true,
    maxImages: 10,
    maxVideos: 1,
    color: 'bg-blue-600',
  },
  INSTAGRAM: {
    name: 'Instagram',
    icon: '📷',
    maxChars: 2200,
    supportsImages: true,
    supportsVideos: true,
    maxImages: 10,
    maxVideos: 1,
    color: 'bg-gradient-to-br from-purple-600 to-pink-500',
  },
  YOUTUBE: {
    name: 'YouTube',
    icon: '▶',
    maxChars: 5000, // Description limit
    supportsImages: false,
    supportsVideos: true,
    maxImages: 0,
    maxVideos: 1,
    color: 'bg-red-600',
  },
  PINTEREST: {
    name: 'Pinterest',
    icon: 'P',
    maxChars: 500,
    supportsImages: true,
    supportsVideos: true,
    maxImages: 1,
    maxVideos: 1,
    color: 'bg-red-700',
  },
};

// List platforms
export function usePlatforms() {
  return useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: async () => {
      const response = await api.get<PlatformListResponse>('/api/platforms');
      return response.data.platforms;
    },
  });
}

// Get platform by ID
export function usePlatform(id: string) {
  return useQuery<Platform>({
    queryKey: ['platforms', id],
    queryFn: async () => {
      const response = await api.get<Platform>(`/api/platforms/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// Create demo platform
export function useCreateDemoPlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { type: PlatformType; name: string; username: string }) => {
      const response = await api.post<Platform>('/api/platforms/demo', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
      toast({
        title: 'Platform connected',
        description: 'Demo platform has been added for testing.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to connect platform',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete platform
export function useDeletePlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/platforms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to disconnect platform',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Platform config response
interface PlatformConfigResponse {
  twitter: boolean;
  linkedin: boolean;
  facebook: boolean;
  instagram: boolean;
  youtube: boolean;
  pinterest: boolean;
}

// Get platform configuration (which platforms are set up)
export function usePlatformConfig() {
  return useQuery<PlatformConfigResponse>({
    queryKey: ['platforms', 'config'],
    queryFn: async () => {
      const response = await api.get<PlatformConfigResponse>('/api/platforms/config');
      return response.data;
    },
  });
}

// Get Twitter auth URL
export function useTwitterAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<{ authUrl: string }>('/api/platforms/twitter/auth-url');
      return response.data;
    },
  });
}

// Get LinkedIn auth URL
export function useLinkedInAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<{ authUrl: string }>('/api/platforms/linkedin/auth-url');
      return response.data;
    },
  });
}

// Get Facebook auth URL
export function useFacebookAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<{ authUrl: string }>('/api/platforms/facebook/auth-url');
      return response.data;
    },
  });
}

// Get Instagram auth URL (uses Facebook OAuth)
export function useInstagramAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<{ authUrl: string }>('/api/platforms/instagram/auth-url');
      return response.data;
    },
  });
}

// Get YouTube auth URL
export function useYouTubeAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<{ authUrl: string }>('/api/platforms/youtube/auth-url');
      return response.data;
    },
  });
}

// Get Pinterest auth URL
export function usePinterestAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get<{ authUrl: string }>('/api/platforms/pinterest/auth-url');
      return response.data;
    },
  });
}

// Generic hook to get auth URL for any platform
export function usePlatformAuthUrl(type: PlatformType) {
  return useMutation({
    mutationFn: async () => {
      const platformKey = type.toLowerCase();
      const response = await api.get<{ authUrl: string }>(`/api/platforms/${platformKey}/auth-url`);
      return response.data;
    },
  });
}
