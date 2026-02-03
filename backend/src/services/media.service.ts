import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Supported media types
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
export const SUPPORTED_EXTENSIONS = [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS];

/**
 * MIME type mappings
 */
export const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

/**
 * Media file info
 */
export interface MediaFileInfo {
  name: string;
  path: string;           // Relative path from media root
  absolutePath: string;   // Absolute path on filesystem
  type: 'image' | 'video';
  extension: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  url: string;            // URL to access the file
}

/**
 * Folder info
 */
export interface FolderInfo {
  name: string;
  path: string;           // Relative path from media root
  fileCount: number;
  subfolderCount: number;
}

/**
 * Browse result
 */
export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  folders: FolderInfo[];
  files: MediaFileInfo[];
}

/**
 * Media Service - handles browsing and serving media files
 */
class MediaServiceClass {
  private mediaRoot: string;
  private uploadsRoot: string;

  constructor() {
    // Resolve paths relative to current working directory
    this.mediaRoot = path.resolve(process.cwd(), env.MEDIA_PATH);
    this.uploadsRoot = path.resolve(process.cwd(), env.MEDIA_UPLOADS_PATH);
  }

  /**
   * Initialize media directories
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.mediaRoot, { recursive: true });
      await fs.mkdir(this.uploadsRoot, { recursive: true });
      await fs.mkdir(this.getUploadsTempRoot(), { recursive: true });
      logger.info({ mediaRoot: this.mediaRoot, uploadsRoot: this.uploadsRoot }, 'Media directories initialized');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize media directories');
      throw error;
    }
  }

  /**
   * Get the media root path
   */
  getMediaRoot(): string {
    return this.mediaRoot;
  }

  /**
   * Get the uploads root path
   */
  getUploadsRoot(): string {
    return this.uploadsRoot;
  }

  /**
   * Get the temp uploads path
   */
  getUploadsTempRoot(): string {
    return path.join(this.uploadsRoot, 'tmp');
  }

  /**
   * Validate and sanitize a path to prevent directory traversal
   */
  private sanitizePath(relativePath: string): string {
    // Remove any leading slashes and normalize
    const normalized = path.normalize(relativePath).replace(/^[/\\]+/, '');
    
    // Check for directory traversal attempts
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid path: directory traversal not allowed');
    }
    
    return normalized;
  }

  /**
   * Resolve a relative path to absolute, validating it's within media root
   */
  private resolveMediaPath(relativePath: string, root: 'media' | 'uploads' = 'media'): string {
    const sanitized = this.sanitizePath(relativePath);
    const baseRoot = root === 'media' ? this.mediaRoot : this.uploadsRoot;
    const absolute = path.join(baseRoot, sanitized);
    
    // Ensure the resolved path is still within the media root
    if (!absolute.startsWith(baseRoot)) {
      throw new Error('Invalid path: outside media directory');
    }
    
    return absolute;
  }

  /**
   * Get file type from extension
   */
  private getFileType(extension: string): 'image' | 'video' | null {
    const ext = extension.toLowerCase();
    if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) return 'video';
    return null;
  }

  /**
   * Build URL for a media file
   */
  private buildFileUrl(relativePath: string, source: 'media' | 'uploads'): string {
    const basePath = source === 'media' ? '/api/media/file' : '/api/media/uploads';
    
    if (env.MEDIA_BASE_URL) {
      return `${env.MEDIA_BASE_URL}/${source}/${relativePath}`;
    }
    
    return `${basePath}/${relativePath}`;
  }

  /**
   * Get info for a single file
   */
  async getFileInfo(relativePath: string, source: 'media' | 'uploads' = 'media'): Promise<MediaFileInfo | null> {
    try {
      const absolutePath = this.resolveMediaPath(relativePath, source);
      const stats = await fs.stat(absolutePath);
      
      if (!stats.isFile()) return null;
      
      const extension = path.extname(relativePath).toLowerCase();
      const fileType = this.getFileType(extension);
      
      if (!fileType) return null;
      
      return {
        name: path.basename(relativePath),
        path: relativePath,
        absolutePath,
        type: fileType,
        extension,
        mimeType: MIME_TYPES[extension] || 'application/octet-stream',
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        url: this.buildFileUrl(relativePath, source),
      };
    } catch {
      return null;
    }
  }

  /**
   * Browse a directory
   */
  async browse(relativePath: string = '', source: 'media' | 'uploads' = 'media'): Promise<BrowseResult> {
    const sanitizedPath = relativePath ? this.sanitizePath(relativePath) : '';
    const absolutePath = this.resolveMediaPath(sanitizedPath, source);
    
    // Check if directory exists
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory');
      }
    } catch {
      throw new Error(`Directory not found: ${sanitizedPath || '/'}`);
    }
    
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    
    const folders: FolderInfo[] = [];
    const files: MediaFileInfo[] = [];
    
    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) continue;
      
      const entryPath = sanitizedPath ? `${sanitizedPath}/${entry.name}` : entry.name;
      const entryAbsolutePath = path.join(absolutePath, entry.name);
      
      if (entry.isDirectory()) {
        // Get folder stats
        const subEntries = await fs.readdir(entryAbsolutePath, { withFileTypes: true });
        const fileCount = subEntries.filter(e => e.isFile() && !e.name.startsWith('.')).length;
        const subfolderCount = subEntries.filter(e => e.isDirectory() && !e.name.startsWith('.')).length;
        
        folders.push({
          name: entry.name,
          path: entryPath,
          fileCount,
          subfolderCount,
        });
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        const fileType = this.getFileType(extension);
        
        if (fileType) {
          const stats = await fs.stat(entryAbsolutePath);
          
          files.push({
            name: entry.name,
            path: entryPath,
            absolutePath: entryAbsolutePath,
            type: fileType,
            extension,
            mimeType: MIME_TYPES[extension] || 'application/octet-stream',
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            url: this.buildFileUrl(entryPath, source),
          });
        }
      }
    }
    
    // Sort folders and files by name
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    // Calculate parent path
    const parentPath = sanitizedPath.includes('/')
      ? sanitizedPath.substring(0, sanitizedPath.lastIndexOf('/'))
      : sanitizedPath ? '' : null;
    
    return {
      currentPath: sanitizedPath || '/',
      parentPath,
      folders,
      files,
    };
  }

  /**
   * Search for files matching a pattern
   */
  async search(query: string, source: 'media' | 'uploads' = 'media'): Promise<MediaFileInfo[]> {
    const results: MediaFileInfo[] = [];
    const root = source === 'media' ? this.mediaRoot : this.uploadsRoot;
    const queryLower = query.toLowerCase();
    
    const searchDir = async (dirPath: string, relativePath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const entryAbsolutePath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await searchDir(entryAbsolutePath, entryPath);
        } else if (entry.isFile() && entry.name.toLowerCase().includes(queryLower)) {
          const extension = path.extname(entry.name).toLowerCase();
          const fileType = this.getFileType(extension);
          
          if (fileType) {
            const stats = await fs.stat(entryAbsolutePath);
            results.push({
              name: entry.name,
              path: entryPath,
              absolutePath: entryAbsolutePath,
              type: fileType,
              extension,
              mimeType: MIME_TYPES[extension] || 'application/octet-stream',
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              url: this.buildFileUrl(entryPath, source),
            });
          }
        }
      }
    };
    
    try {
      await searchDir(root, '');
    } catch (error) {
      logger.error({ err: error, query }, 'Media search failed');
    }
    
    return results.slice(0, 100); // Limit results
  }

  /**
   * Upload a file
   */
  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    subfolder?: string
  ): Promise<MediaFileInfo> {
    const extension = path.extname(file.originalname).toLowerCase();
    const fileType = this.getFileType(extension);
    
    if (!fileType) {
      throw new Error(`Unsupported file type: ${extension}`);
    }
    
    // Check file size
    const maxSize = fileType === 'image' ? env.MEDIA_MAX_IMAGE_SIZE : env.MEDIA_MAX_VIDEO_SIZE;
    if (file.buffer.length > maxSize) {
      throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)} MB`);
    }
    
    // Generate unique filename
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniqueId = uuidv4().slice(0, 8);
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_');
    const filename = `${timestamp}_${uniqueId}_${safeName}`;
    
    // Build target path
    const targetFolder = subfolder ? this.sanitizePath(subfolder) : '';
    const targetDir = path.join(this.uploadsRoot, targetFolder);
    const targetPath = path.join(targetDir, filename);
    const relativePath = targetFolder ? `${targetFolder}/${filename}` : filename;
    
    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    // Write file
    await fs.writeFile(targetPath, file.buffer);
    
    const stats = await fs.stat(targetPath);
    
    logger.info({ path: relativePath, size: stats.size }, 'File uploaded');
    
    return {
      name: filename,
      path: relativePath,
      absolutePath: targetPath,
      type: fileType,
      extension,
      mimeType: MIME_TYPES[extension] || 'application/octet-stream',
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      url: this.buildFileUrl(relativePath, 'uploads'),
    };
  }

  /**
   * Upload a file from a temp path (disk-based upload)
   */
  async uploadFileFromPath(
    file: { path: string; originalname: string; mimetype: string; size?: number },
    subfolder?: string
  ): Promise<MediaFileInfo> {
    try {
      const extension = path.extname(file.originalname).toLowerCase();
      const fileType = this.getFileType(extension);
      
      if (!fileType) {
        throw new Error(`Unsupported file type: ${extension}`);
      }
      
      const stats = file.size ? { size: file.size } : await fs.stat(file.path);
      
      // Check file size
      const maxSize = fileType === 'image' ? env.MEDIA_MAX_IMAGE_SIZE : env.MEDIA_MAX_VIDEO_SIZE;
      if (stats.size > maxSize) {
        throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)} MB`);
      }
      
      // Generate unique filename
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uniqueId = uuidv4().slice(0, 8);
      const safeName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_');
      const filename = `${timestamp}_${uniqueId}_${safeName}`;
      
      // Build target path
      const targetFolder = subfolder ? this.sanitizePath(subfolder) : '';
      const targetDir = path.join(this.uploadsRoot, targetFolder);
      const targetPath = path.join(targetDir, filename);
      const relativePath = targetFolder ? `${targetFolder}/${filename}` : filename;
      
      // Ensure directory exists
      await fs.mkdir(targetDir, { recursive: true });
      
      // Move file into place
      await this.moveFile(file.path, targetPath);
      
      const finalStats = await fs.stat(targetPath);
      
      logger.info({ path: relativePath, size: finalStats.size }, 'File uploaded');
      
      return {
        name: filename,
        path: relativePath,
        absolutePath: targetPath,
        type: fileType,
        extension,
        mimeType: MIME_TYPES[extension] || 'application/octet-stream',
        size: finalStats.size,
        createdAt: finalStats.birthtime,
        modifiedAt: finalStats.mtime,
        url: this.buildFileUrl(relativePath, 'uploads'),
      };
    } catch (error) {
      await this.safeUnlink(file.path);
      throw error;
    }
  }

  private async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EXDEV') {
        await fs.copyFile(sourcePath, targetPath);
        await this.safeUnlink(sourcePath);
        return;
      }
      throw error;
    }
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup failures
    }
  }

  /**
   * Delete an uploaded file (only from uploads folder)
   */
  async deleteUploadedFile(relativePath: string): Promise<void> {
    const absolutePath = this.resolveMediaPath(relativePath, 'uploads');
    
    // Verify file exists and is within uploads
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('File not found');
    }
    
    await fs.unlink(absolutePath);
    logger.info({ path: relativePath }, 'File deleted');
  }

  /**
   * Create a folder in uploads
   */
  async createFolder(relativePath: string): Promise<FolderInfo> {
    const sanitizedPath = this.sanitizePath(relativePath);
    const absolutePath = path.join(this.uploadsRoot, sanitizedPath);
    
    await fs.mkdir(absolutePath, { recursive: true });
    
    return {
      name: path.basename(sanitizedPath),
      path: sanitizedPath,
      fileCount: 0,
      subfolderCount: 0,
    };
  }

  /**
   * Resolve a media reference (local: path or URL)
   */
  async resolveMediaReference(reference: string): Promise<MediaFileInfo | null> {
    if (reference.startsWith('local:')) {
      const localPath = reference.substring(6); // Remove 'local:' prefix
      
      // Try media folder first, then uploads
      let fileInfo = await this.getFileInfo(localPath, 'media');
      if (!fileInfo) {
        fileInfo = await this.getFileInfo(localPath, 'uploads');
      }
      
      return fileInfo;
    }
    
    // It's a URL, return null (caller should handle URLs separately)
    return null;
  }

  /**
   * Check if a reference is a local path
   */
  isLocalPath(reference: string): boolean {
    return reference.startsWith('local:');
  }

  /**
   * Get absolute path for a local reference
   */
  async getAbsolutePathForReference(reference: string): Promise<string | null> {
    const fileInfo = await this.resolveMediaReference(reference);
    return fileInfo?.absolutePath || null;
  }
}

export const mediaService = new MediaServiceClass();
