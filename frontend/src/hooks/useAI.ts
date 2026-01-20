import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AIConfig {
  available: boolean;
  defaultModel: string;
  availableModels: string[];
}

export interface RefineContentInput {
  content: string;
  platforms: string[];
  additionalContext?: string;
  model?: string;
}

export interface RefineContentResult {
  refinedContent: string;
  model: string;
  platforms: string[];
  characterLimit: number;
}

/**
 * Get AI configuration
 */
export function useAIConfig() {
  return useQuery<AIConfig>({
    queryKey: ['ai', 'config'],
    queryFn: async () => {
      const response = await api.get<AIConfig>('/api/ai/config');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Refine content with AI
 */
export function useRefineContent() {
  return useMutation<RefineContentResult, Error, RefineContentInput>({
    mutationFn: async (input) => {
      const response = await api.post<RefineContentResult>('/api/ai/refine', input);
      return response.data;
    },
  });
}
