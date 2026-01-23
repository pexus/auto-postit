import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const quotaRouter = Router();

// Apply auth middleware to all quota routes
quotaRouter.use(requireAuth);

// Platform quota limits (free tier defaults)
const PLATFORM_LIMITS: Record<string, { daily: number; monthly: number; name: string }> = {
  TWITTER: { daily: 50, monthly: 1500, name: 'Twitter/X' },
  LINKEDIN: { daily: 100, monthly: 3000, name: 'LinkedIn' },
  FACEBOOK: { daily: 50, monthly: 1500, name: 'Facebook' },
  INSTAGRAM: { daily: 25, monthly: 750, name: 'Instagram' },
  YOUTUBE: { daily: 10, monthly: 300, name: 'YouTube' },
  PINTEREST: { daily: 50, monthly: 1500, name: 'Pinterest' },
};

/**
 * GET /api/quota
 * Get quota usage for all platforms
 */
quotaRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.userId!;

    // Get all connected platforms
    const platforms = await prisma.platform.findMany({
      where: { userId, isActive: true },
      select: { id: true, type: true, name: true },
    });

    // Get current period dates
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get usage for each platform type
    const quotaData = await Promise.all(
      platforms.map(async (platform) => {
        const limits = PLATFORM_LIMITS[platform.type] || { daily: 50, monthly: 1500, name: platform.type };

        // Get daily usage (count posts published today)
        const dailyPosts = await prisma.post.count({
          where: {
            userId,
            status: 'PUBLISHED',
            publishedAt: { gte: todayStart },
            platforms: {
              some: { platformId: platform.id },
            },
          },
        });

        // Get monthly usage
        const monthlyPosts = await prisma.post.count({
          where: {
            userId,
            status: 'PUBLISHED',
            publishedAt: { gte: monthStart },
            platforms: {
              some: { platformId: platform.id },
            },
          },
        });

        return {
          platformId: platform.id,
          platformType: platform.type,
          platformName: platform.name,
          displayName: limits.name,
          daily: {
            used: dailyPosts,
            limit: limits.daily,
            remaining: Math.max(0, limits.daily - dailyPosts),
            percentage: Math.min(100, Math.round((dailyPosts / limits.daily) * 100)),
          },
          monthly: {
            used: monthlyPosts,
            limit: limits.monthly,
            remaining: Math.max(0, limits.monthly - monthlyPosts),
            percentage: Math.min(100, Math.round((monthlyPosts / limits.monthly) * 100)),
          },
          isNearLimit: dailyPosts >= limits.daily * 0.8 || monthlyPosts >= limits.monthly * 0.8,
          isAtLimit: dailyPosts >= limits.daily || monthlyPosts >= limits.monthly,
        };
      })
    );

    // Calculate totals
    const totalDaily = quotaData.reduce((sum, q) => sum + q.daily.used, 0);
    const totalMonthly = quotaData.reduce((sum, q) => sum + q.monthly.used, 0);
    const platformsNearLimit = quotaData.filter(q => q.isNearLimit).length;
    const platformsAtLimit = quotaData.filter(q => q.isAtLimit).length;

    res.json({
      platforms: quotaData,
      summary: {
        totalDailyPosts: totalDaily,
        totalMonthlyPosts: totalMonthly,
        connectedPlatforms: platforms.length,
        platformsNearLimit,
        platformsAtLimit,
      },
      limits: PLATFORM_LIMITS,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/quota/:platformType
 * Get quota usage for a specific platform type
 */
quotaRouter.get('/:platformType', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { platformType } = req.params;

    const platform = await prisma.platform.findFirst({
      where: { userId, type: platformType as any, isActive: true },
    });

    if (!platform) {
      res.status(404).json({ error: 'Platform not connected' });
      return;
    }

    const limits = PLATFORM_LIMITS[platformType] || { daily: 50, monthly: 1500, name: platformType };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyPosts = await prisma.post.count({
      where: {
        userId,
        status: 'PUBLISHED',
        publishedAt: { gte: todayStart },
        platforms: { some: { platformId: platform.id } },
      },
    });

    const monthlyPosts = await prisma.post.count({
      where: {
        userId,
        status: 'PUBLISHED',
        publishedAt: { gte: monthStart },
        platforms: { some: { platformId: platform.id } },
      },
    });

    res.json({
      platformId: platform.id,
      platformType: platform.type,
      platformName: platform.name,
      daily: {
        used: dailyPosts,
        limit: limits.daily,
        remaining: Math.max(0, limits.daily - dailyPosts),
      },
      monthly: {
        used: monthlyPosts,
        limit: limits.monthly,
        remaining: Math.max(0, limits.monthly - monthlyPosts),
      },
    });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/quota/check/:platformType
 * Check if posting is allowed (quota not exceeded)
 */
quotaRouter.get('/check/:platformType', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { platformType } = req.params;

    const platform = await prisma.platform.findFirst({
      where: { userId, type: platformType as any, isActive: true },
    });

    if (!platform) {
      res.json({ allowed: false, reason: 'Platform not connected' });
      return;
    }

    const limits = PLATFORM_LIMITS[platformType] || { daily: 50, monthly: 1500 };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyPosts = await prisma.post.count({
      where: {
        userId,
        status: 'PUBLISHED',
        publishedAt: { gte: todayStart },
        platforms: { some: { platformId: platform.id } },
      },
    });

    const monthlyPosts = await prisma.post.count({
      where: {
        userId,
        status: 'PUBLISHED',
        publishedAt: { gte: monthStart },
        platforms: { some: { platformId: platform.id } },
      },
    });

    const dailyExceeded = dailyPosts >= limits.daily;
    const monthlyExceeded = monthlyPosts >= limits.monthly;

    res.json({
      allowed: !dailyExceeded && !monthlyExceeded,
      dailyExceeded,
      monthlyExceeded,
      dailyRemaining: Math.max(0, limits.daily - dailyPosts),
      monthlyRemaining: Math.max(0, limits.monthly - monthlyPosts),
    });
    return;
  } catch (error) {
    next(error);
  }
});
