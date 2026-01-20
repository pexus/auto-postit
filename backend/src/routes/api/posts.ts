import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PostStatus, PlatformType } from '@prisma/client';
import { postService } from '../../services/post.service.js';

export const postsRouter = Router();

// Validation schemas
const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
  scheduledAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  platformIds: z.array(z.string().uuid()).optional().default([]),
  mediaFileIds: z.array(z.string().uuid()).optional().default([]),
});

const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  scheduledAt: z.string().datetime().nullable().optional().transform(val => 
    val === null ? null : val ? new Date(val) : undefined
  ),
  platformIds: z.array(z.string().uuid()).optional(),
  mediaFileIds: z.array(z.string().uuid()).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED']).optional(),
});

const schedulePostSchema = z.object({
  scheduledAt: z.string().datetime().transform(val => new Date(val)),
});

const listPostsSchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED']).optional(),
  platformType: z.enum(['TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'PINTEREST']).optional(),
  fromDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  toDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * GET /api/posts
 * List all posts with optional filters
 */
postsRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = listPostsSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: query.error.flatten() });
      return;
    }

    const { page, limit, ...filters } = query.data;
    const result = await postService.list(
      userId, 
      filters as { status?: PostStatus; platformType?: PlatformType; fromDate?: Date; toDate?: Date }, 
      page, 
      limit
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/posts/stats
 * Get post statistics
 */
postsRouter.get('/stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await postService.getStats(userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Helper to safely get post ID from params
function getPostId(req: Request): string | null {
  const id = req.params.id;
  if (!id || typeof id !== 'string') {
    return null;
  }
  return id;
}

/**
 * GET /api/posts/:id
 * Get a single post by ID
 */
postsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const postId = getPostId(req);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!postId) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }

    const post = await postService.getById(userId, postId);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/posts
 * Create a new post
 */
postsRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createPostSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
      return;
    }

    const post = await postService.create(userId, body.data);
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/posts/:id
 * Update a post
 */
postsRouter.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const postId = getPostId(req);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!postId) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }

    const body = updatePostSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
      return;
    }

    const post = await postService.update(userId, postId, body.data);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot edit')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a post
 */
postsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const postId = getPostId(req);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!postId) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }

    const deleted = await postService.delete(userId, postId);

    if (!deleted) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/posts/:id/schedule
 * Schedule a post for publishing
 */
postsRouter.post('/:id/schedule', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const postId = getPostId(req);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!postId) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }

    const body = schedulePostSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Invalid request body', details: body.error.flatten() });
      return;
    }

    const post = await postService.schedule(userId, postId, body.data.scheduledAt);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('platform') || error.message.includes('schedule')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    next(error);
  }
});

/**
 * POST /api/posts/:id/unschedule
 * Cancel a scheduled post (return to draft)
 */
postsRouter.post('/:id/unschedule', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    const postId = getPostId(req);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!postId) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }

    const post = await postService.unschedule(userId, postId);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
  } catch (error) {
    if (error instanceof Error && error.message.includes('unschedule')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});
