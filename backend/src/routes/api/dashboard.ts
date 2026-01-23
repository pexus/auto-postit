import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
dashboardRouter.get('/stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get counts in parallel
    const [
      totalPosts,
      connectedPlatforms,
      scheduledPosts,
      recentPosts,
    ] = await Promise.all([
      // Total posts
      prisma.post.count({
        where: { userId },
      }),
      // Connected platforms (active)
      prisma.platform.count({
        where: { userId, isActive: true },
      }),
      // Scheduled posts
      prisma.post.count({
        where: { 
          userId, 
          status: 'SCHEDULED',
          scheduledAt: { gt: new Date() },
        },
      }),
      // Recent posts (last 10)
      prisma.post.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          platforms: {
            include: {
              platform: {
                select: {
                  id: true,
                  type: true,
                  name: true,
                  platformUsername: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Count platforms near quota limit (placeholder - would need actual quota tracking)
    const quotaWarnings = 0; // TODO: Implement quota warning count

    res.json({
      totalPosts,
      connectedPlatforms,
      scheduledPosts,
      quotaWarnings,
      recentPosts: recentPosts.map(post => ({
        id: post.id,
        content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        status: post.status,
        createdAt: post.createdAt,
        publishedAt: post.publishedAt,
        platforms: post.platforms.map(pp => ({
          type: pp.platform.type,
          name: pp.platform.name || pp.platform.platformUsername,
          status: pp.status,
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});
