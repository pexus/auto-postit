import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { mediaService, SUPPORTED_EXTENSIONS } from '../../services/media.service.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

export const mediaRouter = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max (validated further in service)
  },
  fileFilter: (_req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${SUPPORTED_EXTENSIONS.join(', ')}`));
    }
  },
});

/**
 * GET /api/media/browse
 * Browse media directory
 */
mediaRouter.get('/browse', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const path = (req.query.path as string) || '';
    const source = (req.query.source as 'media' | 'uploads') || 'media';
    
    if (source !== 'media' && source !== 'uploads') {
      res.status(400).json({ error: 'Invalid source. Must be "media" or "uploads"' });
      return;
    }
    
    const result = await mediaService.browse(path, source);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/search
 * Search for files
 */
mediaRouter.get('/search', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query.q as string;
    const source = (req.query.source as 'media' | 'uploads') || 'media';
    
    if (!query || query.length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }
    
    if (source !== 'media' && source !== 'uploads') {
      res.status(400).json({ error: 'Invalid source. Must be "media" or "uploads"' });
      return;
    }
    
    const results = await mediaService.search(query, source);
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/info/*
 * Get file info
 */
mediaRouter.get('/info/*', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filePath = req.params[0];
    const source = (req.query.source as 'media' | 'uploads') || 'media';
    
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }
    
    if (source !== 'media' && source !== 'uploads') {
      res.status(400).json({ error: 'Invalid source. Must be "media" or "uploads"' });
      return;
    }
    
    const fileInfo = await mediaService.getFileInfo(filePath, source);
    
    if (!fileInfo) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    res.json(fileInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/file/*
 * Serve a file from media folder
 */
mediaRouter.get('/file/*', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }
    
    const fileInfo = await mediaService.getFileInfo(filePath, 'media');
    
    if (!fileInfo) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    const stats = await stat(fileInfo.absolutePath);
    
    // Set headers
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests (for video streaming)
    const range = req.headers.range;
    if (range && fileInfo.type === 'video') {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0] || '0', 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = createReadStream(fileInfo.absolutePath, { start, end });
      stream.pipe(res);
    } else {
      const stream = createReadStream(fileInfo.absolutePath);
      stream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/uploads/*
 * Serve a file from uploads folder
 */
mediaRouter.get('/uploads/*', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }
    
    const fileInfo = await mediaService.getFileInfo(filePath, 'uploads');
    
    if (!fileInfo) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    const stats = await stat(fileInfo.absolutePath);
    
    // Set headers
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests
    const range = req.headers.range;
    if (range && fileInfo.type === 'video') {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0] || '0', 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = createReadStream(fileInfo.absolutePath, { start, end });
      stream.pipe(res);
    } else {
      const stream = createReadStream(fileInfo.absolutePath);
      stream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/media/upload
 * Upload a file
 */
mediaRouter.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }
      
      const subfolder = req.body.folder as string | undefined;
      
      const fileInfo = await mediaService.uploadFile(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        },
        subfolder
      );
      
      logger.info(
        { filename: fileInfo.name, size: fileInfo.size, type: fileInfo.type },
        'File uploaded via API'
      );
      
      res.status(201).json(fileInfo);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/media/folder
 * Create a folder
 */
mediaRouter.post('/folder', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath || typeof folderPath !== 'string') {
      res.status(400).json({ error: 'Folder path is required' });
      return;
    }
    
    const folderInfo = await mediaService.createFolder(folderPath);
    res.status(201).json(folderInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/media/uploads/*
 * Delete an uploaded file
 */
mediaRouter.delete('/uploads/*', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }
    
    await mediaService.deleteUploadedFile(filePath);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/resolve
 * Resolve a media reference (local: path or URL)
 */
mediaRouter.get('/resolve', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reference = req.query.ref as string;
    
    if (!reference) {
      res.status(400).json({ error: 'Reference is required' });
      return;
    }
    
    const fileInfo = await mediaService.resolveMediaReference(reference);
    
    if (!fileInfo) {
      if (mediaService.isLocalPath(reference)) {
        res.status(404).json({ error: 'Local file not found' });
        return;
      }
      // It's a URL
      res.json({ type: 'url', url: reference });
      return;
    }
    
    // For local files, include both type and fileInfo properties
    res.json({ 
      mediaType: 'local', 
      ...fileInfo 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/media/supported-formats
 * Get supported file formats
 */
mediaRouter.get('/supported-formats', (_req: Request, res: Response) => {
  res.json({
    images: {
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    },
    videos: {
      extensions: ['.mp4', '.mov', '.webm'],
      mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    },
  });
});

/**
 * POST /api/media/register
 * Register media files from filesystem into the database
 * This creates MediaFile records that can be linked to posts
 */
mediaRouter.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { files } = req.body as { files: Array<{ path: string; source: 'media' | 'uploads' }> };

    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: 'Files array is required' });
      return;
    }

    const registeredFiles: Array<{ id: string; filename: string; storagePath: string; mimeType: string }> = [];

    for (const fileRef of files) {
      const { path: filePath, source } = fileRef;

      if (!filePath || !source || (source !== 'media' && source !== 'uploads')) {
        continue;
      }

      // Get file info from filesystem
      const fileInfo = await mediaService.getFileInfo(filePath, source);
      if (!fileInfo) {
        logger.warn({ filePath, source }, 'File not found for registration');
        continue;
      }

      // Check if already registered
      const existing = await prisma.mediaFile.findFirst({
        where: {
          userId,
          storagePath: `${source}:${filePath}`,
        },
      });

      if (existing) {
        registeredFiles.push({
          id: existing.id,
          filename: existing.filename,
          storagePath: existing.storagePath,
          mimeType: existing.mimeType,
        });
        continue;
      }

      // Create new MediaFile record
      const mediaFile = await prisma.mediaFile.create({
        data: {
          userId,
          filename: fileInfo.name,
          storagePath: `${source}:${filePath}`,
          mimeType: fileInfo.mimeType,
          size: fileInfo.size,
          width: null, // Could extract with sharp/ffprobe later
          height: null,
          duration: null,
        },
      });

      registeredFiles.push({
        id: mediaFile.id,
        filename: mediaFile.filename,
        storagePath: mediaFile.storagePath,
        mimeType: mediaFile.mimeType,
      });

      logger.info({ mediaFileId: mediaFile.id, filePath, source }, 'Media file registered');
    }

    res.status(201).json({ files: registeredFiles });
  } catch (error) {
    next(error);
  }
});
