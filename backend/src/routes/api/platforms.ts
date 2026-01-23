import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PlatformType } from '@prisma/client';
import { platformService } from '../../services/platform.service.js';
import { twitterService } from '../../services/twitter.service.js';

export const platformsRouter = Router();

// Validation schemas
const createDemoPlatformSchema = z.object({
  type: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'PINTEREST']),
  name: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
});

/**
 * GET /api/platforms
 * List all connected platforms
 */
platformsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const platforms = await platformService.listForUser(userId);
    res.json({ platforms });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/platforms/config
 * Get platform configuration (which platforms are configured)
 */
platformsRouter.get('/config', async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  res.json({
    twitter: twitterService.isConfigured(),
    linkedin: false, // TODO: implement
    facebook: false, // TODO: implement
    instagram: false, // TODO: implement
    youtube: false, // TODO: implement
    pinterest: false, // TODO: implement
  });
});

/**
 * GET /api/platforms/twitter/auth-url
 * Get Twitter authorization URL
 */
platformsRouter.get('/twitter/auth-url', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!twitterService.isConfigured()) {
      res.status(503).json({ error: 'Twitter is not configured' });
      return;
    }

    const authUrl = twitterService.generateAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/platforms/:id
 * Get platform details
 */
platformsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const platformId = req.params.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!platformId || typeof platformId !== 'string') {
      res.status(400).json({ error: 'Invalid platform ID' });
      return;
    }

    const platform = await platformService.getById(userId, platformId);

    if (!platform) {
      res.status(404).json({ error: 'Platform not found' });
      return;
    }

    res.json(platform);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/platforms/demo
 * Create a demo platform for testing (temporary until OAuth is implemented)
 */
platformsRouter.post('/demo', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createDemoPlatformSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
      return;
    }

    const platform = await platformService.createDemoPlatform(
      userId,
      body.data.type as PlatformType,
      body.data.name,
      body.data.username
    );

    res.status(201).json(platform);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/platforms/:type/connect
 * Initiate OAuth flow to connect a platform
 */
platformsRouter.post('/:type/connect', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // TODO: Implement platform connection initiation (OAuth)
    res.status(501).json({ error: 'OAuth not implemented yet. Use /api/platforms/demo for testing.' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/platforms/:id
 * Disconnect a platform
 */
platformsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const platformId = req.params.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!platformId || typeof platformId !== 'string') {
      res.status(400).json({ error: 'Invalid platform ID' });
      return;
    }

    const deleted = await platformService.delete(userId, platformId);

    if (!deleted) {
      res.status(404).json({ error: 'Platform not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/platforms/:id/refresh
 * Manually refresh platform tokens
 */
platformsRouter.post('/:id/refresh', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // TODO: Implement token refresh
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/platforms/:id/status
 * Check platform connection status
 */
platformsRouter.get('/:id/status', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // TODO: Implement platform status check
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    next(error);
  }
});
