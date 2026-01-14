import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export interface MediaFileInfo {
  name: string;
  path: string;
  absolutePath: string;
  type: 'image' | 'video';
  extension: string;
  mimeType: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  url: string;
}

export interface FolderInfo {
  name: string;
  path: string;
  fileCount: number;
  subfolderCount: number;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  folders: FolderInfo[];
  files: MediaFileInfo[];
}

export interface SearchResult {
  results: MediaFileInfo[];
}

export type MediaSource = 'media' | 'uploads';

// Browse media directory
export function useMediaBrowse(path: string = '', source: MediaSource = 'media') {
  return useQuery<BrowseResult>({
    queryKey: ['media', 'browse', source, path],
    queryFn: async () => {
      const response = await api.get<BrowseResult>('/api/media/browse', {
        params: { path, source },
      });
      return response.data;
    },
  });
}

// Search media files
export function useMediaSearch(query: string, source: MediaSource = 'media') {
  return useQuery<SearchResult>({
    queryKey: ['media', 'search', source, query],
    queryFn: async () => {
      const response = await api.get<SearchResult>('/api/media/search', {
        params: { q: query, source },
      });
      return response.data;
    },
    enabled: query.length >= 2,
  });
}

// Get file info
export function useMediaFileInfo(path: string, source: MediaSource = 'media') {
  return useQuery<MediaFileInfo>({
    queryKey: ['media', 'info', source, path],
    queryFn: async () => {
      const response = await api.get<MediaFileInfo>(`/api/media/info/${path}`, {
        params: { source },
      });
      return response.data;
    },
    enabled: !!path,
  });
}

// Upload file mutation
export function useMediaUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, folder }: { file: File; folder?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (folder) {
        formData.append('folder', folder);
      }
      
      const response = await api.post<MediaFileInfo>('/api/media/upload', formData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: 'File uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });
}

// Create folder mutation
export function useMediaCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (path: string) => {
      const response = await api.post<FolderInfo>('/api/media/folder', { path });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: 'Folder created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create folder', description: error.message, variant: 'destructive' });
    },
  });
}

// Delete file mutation
export function useMediaDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (path: string) => {
      await api.delete(`/api/media/uploads/${path}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast({ title: 'File deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete file', description: error.message, variant: 'destructive' });
    },
  });
}

// Get supported formats
export function useMediaFormats() {
  return useQuery({
    queryKey: ['media', 'formats'],
    queryFn: async () => {
      const response = await api.get('/api/media/supported-formats');
      return response.data;
    },
    staleTime: Infinity,
  });
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get local path reference for imports
export function getLocalPath(file: MediaFileInfo): string {
  return `local:${file.path}`;
}
