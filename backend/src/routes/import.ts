import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '@/middleware/auth';
import { importService } from '@/services/import.service';
import { logger } from '@/lib/logger';

const importRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

/**
 * POST /api/import/spreadsheet
 * Import posts from a CSV or Excel file
 */
importRouter.post(
  '/spreadsheet',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { message: 'No file uploaded' },
        });
        return;
      }

      const dryRun = req.body.dry_run === 'true' || req.body.dry_run === true;
      const userId = req.userId!;

      logger.info({
        userId,
        filename: req.file.originalname,
        size: req.file.size,
        dryRun,
      }, 'Processing spreadsheet import');

      const result = await importService.processFile(
        userId,
        {
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
        },
        { dryRun }
      );

      // Return appropriate status code
      const statusCode = result.success ? 200 : result.summary.imported > 0 ? 207 : 400;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/import/template.csv
 * Download CSV template
 */
importRouter.get('/template.csv', (_req: Request, res: Response) => {
  const csv = importService.generateCSVTemplate();
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="auto-postit-import-template.csv"');
  res.send(csv);
});

/**
 * GET /api/import/template.xlsx
 * Download Excel template
 */
importRouter.get('/template.xlsx', (_req: Request, res: Response) => {
  const xlsx = importService.generateExcelTemplate();
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="auto-postit-import-template.xlsx"');
  res.send(xlsx);
});

/**
 * GET /api/import/formats
 * Get information about supported import formats
 */
importRouter.get('/formats', (_req: Request, res: Response) => {
  res.json({
    supported_formats: ['csv', 'xlsx'],
    columns: [
      { name: 'platform', required: true, description: 'Target platform (x, linkedin, facebook, instagram, youtube, pinterest)' },
      { name: 'scheduled_date', required: true, description: 'ISO 8601 date (e.g., 2025-01-15T10:00:00Z)' },
      { name: 'content', required: true, description: 'Post text content' },
      { name: 'media_urls', required: false, description: 'Comma-separated media URLs or local paths (prefix with "local:" for files in media folder, e.g., "local:images/photo.jpg")' },
      { name: 'tags', required: false, description: 'Comma-separated tags/hashtags' },
      { name: 'link', required: false, description: 'Link to include in post' },
      { name: 'title', required: false, description: 'Title (YouTube/Pinterest)' },
      { name: 'description', required: false, description: 'Description (YouTube/Pinterest)' },
      { name: 'board', required: false, description: 'Pinterest board name' },
      { name: 'privacy', required: false, description: 'YouTube privacy (public/unlisted/private)' },
    ],
    platform_limits: {
      x: { max_content: 280, max_media: 4, requires_media: false },
      linkedin: { max_content: 3000, max_media: 9, requires_media: false },
      facebook: { max_content: 63206, max_media: 10, requires_media: false },
      instagram: { max_content: 2200, max_media: 10, requires_media: true },
      youtube: { max_content: 5000, max_media: 1, requires_media: true, requires_title: true },
      pinterest: { max_content: 500, max_media: 1, requires_media: true, requires_title: true },
    },
    media_paths: {
      local_prefix: 'local:',
      example: 'local:images/my-photo.jpg',
      description: 'Use "local:" prefix to reference files in the media folder',
    },
    templates: {
      csv: '/api/import/template.csv',
      xlsx: '/api/import/template.xlsx',
    },
  });
});

export { importRouter };
