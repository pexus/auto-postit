import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { PlatformType } from './usePlatforms';

// Types
export type PostStatus = 
  | 'DRAFT' 
  | 'SCHEDULED' 
  | 'PUBLISHING' 
  | 'PUBLISHED' 
  | 'PARTIALLY_PUBLISHED' 
  | 'FAILED';

export interface PostPlatform {
  id: string;
  platformId: string;
  contentOverride: string | null;
  status: PostStatus;
  platformPostUrl: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  platform: {
    id: string;
    type: PlatformType;
    name: string;
    platformUsername: string | null;
  };
}

export interface PostMedia {
  id: string;
  order: number;
  media: {
    id: string;
    filename: string;
    mimeType: string;
    url: string;
  };
}

export interface Post {
  id: string;
  content: string;
  status: PostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  platforms: PostPlatform[];
  mediaFiles: PostMedia[];
}

export interface PostsListResponse {
  posts: Post[];
  total: number;
  pages: number;
}

export interface PostStats {
  total: number;
  draft: number;
  scheduled: number;
  published: number;
  failed: number;
}

export interface PostFilters {
  status?: PostStatus;
  platformType?: PlatformType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreatePostInput {
  content: string;
  scheduledAt?: string;
  platformIds?: string[];
  mediaIds?: string[];
}

export interface UpdatePostInput {
  content?: string;
  scheduledAt?: string | null;
  platformIds?: string[];
  mediaIds?: string[];
  status?: 'DRAFT' | 'SCHEDULED';
}

// List posts
export function usePosts(filters: PostFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.platformType) params.set('platformType', filters.platformType);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  return useQuery<PostsListResponse>({
    queryKey: ['posts', filters],
    queryFn: async () => {
      const queryString = params.toString();
      const url = queryString ? `/api/posts?${queryString}` : '/api/posts';
      const response = await api.get<PostsListResponse>(url);
      return response.data;
    },
  });
}

// Get single post
export function usePost(id: string) {
  return useQuery<Post>({
    queryKey: ['posts', id],
    queryFn: async () => {
      const response = await api.get<Post>(`/api/posts/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

// Get post stats
export function usePostStats() {
  return useQuery<PostStats>({
    queryKey: ['posts', 'stats'],
    queryFn: async () => {
      const response = await api.get<PostStats>('/api/posts/stats');
      return response.data;
    },
  });
}

// Create post
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePostInput) => {
      const response = await api.post<Post>('/api/posts', data);
      return response.data;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: post.status === 'SCHEDULED' ? 'Post scheduled' : 'Post saved as draft',
        description: post.status === 'SCHEDULED' 
          ? `Post will be published at ${new Date(post.scheduledAt!).toLocaleString()}`
          : 'Your post has been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update post
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePostInput }) => {
      const response = await api.put<Post>(`/api/posts/${id}`, data);
      return response.data;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', post.id] });
      toast({
        title: 'Post updated',
        description: 'Your changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete post
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({
        title: 'Post deleted',
        description: 'The post has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Schedule post
export function useSchedulePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const response = await api.post<Post>(`/api/posts/${id}/schedule`, { scheduledAt });
      return response.data;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', post.id] });
      toast({
        title: 'Post scheduled',
        description: `Post will be published at ${new Date(post.scheduledAt!).toLocaleString()}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to schedule post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Unschedule post
export function useUnschedulePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<Post>(`/api/posts/${id}/unschedule`);
      return response.data;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', post.id] });
      toast({
        title: 'Post unscheduled',
        description: 'The post has been returned to drafts.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to unschedule post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
