import { prisma } from '../lib/prisma.js';
import { PlatformType, Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';

export interface PlatformWithoutTokens {
  id: string;
  type: PlatformType;
  name: string;
  platformUserId: string;
  platformUsername: string | null;
  metadata: Prisma.JsonValue;
  isActive: boolean;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class PlatformService {
  /**
   * List all platforms for a user (without exposing tokens)
   */
  async listForUser(userId: string): Promise<PlatformWithoutTokens[]> {
    const platforms = await prisma.platform.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        name: true,
        platformUserId: true,
        platformUsername: true,
        metadata: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return platforms;
  }

  /**
   * Get a platform by ID (without exposing tokens)
   */
  async getById(userId: string, platformId: string): Promise<PlatformWithoutTokens | null> {
    const platform = await prisma.platform.findFirst({
      where: { id: platformId, userId },
      select: {
        id: true,
        type: true,
        name: true,
        platformUserId: true,
        platformUsername: true,
        metadata: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return platform;
  }

  /**
   * Check if user has any connected platforms
   */
  async hasConnectedPlatforms(userId: string): Promise<boolean> {
    const count = await prisma.platform.count({
      where: { userId, isActive: true },
    });
    return count > 0;
  }

  /**
   * Create a mock/demo platform (for testing until OAuth is implemented)
   */
  async createDemoPlatform(
    userId: string,
    type: PlatformType,
    name: string,
    username: string
  ): Promise<PlatformWithoutTokens> {
    const platform = await prisma.platform.create({
      data: {
        userId,
        type,
        name,
        platformUserId: `demo_${type.toLowerCase()}_${Date.now()}`,
        platformUsername: username,
        accessToken: 'demo_token_not_valid',
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        name: true,
        platformUserId: true,
        platformUsername: true,
        metadata: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({ platformId: platform.id, userId, type }, 'Demo platform created');
    return platform;
  }

  /**
   * Delete a platform
   */
  async delete(userId: string, platformId: string): Promise<boolean> {
    const platform = await prisma.platform.findFirst({
      where: { id: platformId, userId },
    });

    if (!platform) {
      return false;
    }

    await prisma.platform.delete({ where: { id: platformId } });
    logger.info({ platformId, userId }, 'Platform deleted');
    return true;
  }
}

export const platformService = new PlatformService();
