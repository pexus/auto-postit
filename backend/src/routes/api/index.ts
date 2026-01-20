import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';

// Sub-routers
import { postsRouter } from './posts.js';
import { platformsRouter } from './platforms.js';
import { mediaRouter } from './media.js';
import { quotaRouter } from './quota.js';
import { settingsRouter } from './settings.js';
import { importRouter } from '../import.js';
import { aiRouter } from './ai.js';

export const apiRouter = Router();

// All API routes require authentication
apiRouter.use(requireAuth);

// Mount sub-routers
apiRouter.use('/posts', postsRouter);
apiRouter.use('/platforms', platformsRouter);
apiRouter.use('/media', mediaRouter);
apiRouter.use('/quota', quotaRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/import', importRouter);
apiRouter.use('/ai', aiRouter);
