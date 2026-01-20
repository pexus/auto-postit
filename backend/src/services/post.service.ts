import { prisma } from '../lib/prisma.js';
import { PostStatus, PlatformType, Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';

export interface CreatePostInput {
  content: string;
  scheduledAt?: Date | undefined;
  platformIds?: string[] | undefined;
  mediaFileIds?: string[] | undefined;
}

export interface UpdatePostInput {
  content?: string | undefined;
  scheduledAt?: Date | null | undefined;
  platformIds?: string[] | undefined;
  mediaFileIds?: string[] | undefined;
  status?: PostStatus | undefined;
}

export interface PostFilters {
  status?: PostStatus | undefined;
  platformType?: PlatformType | undefined;
  fromDate?: Date | undefined;
  toDate?: Date | undefined;
}

// Use Prisma's generated types for the return type
const postInclude = {
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
    orderBy: { createdAt: 'asc' as const },
  },
  mediaFiles: {
    include: {
      mediaFile: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          storagePath: true,
        },
      },
    },
    orderBy: { order: 'asc' as const },
  },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

class PostService {
  /**
   * Create a new post
   */
  async create(userId: string, input: CreatePostInput): Promise<PostWithRelations> {
    const { content, scheduledAt, platformIds = [], mediaFileIds = [] } = input;

    // Determine initial status
    let status: PostStatus = 'DRAFT';
    if (scheduledAt && scheduledAt > new Date()) {
      status = 'SCHEDULED';
    }

    // Build the data object conditionally to avoid undefined values
    const createData: Prisma.PostCreateInput = {
      user: { connect: { id: userId } },
      content,
      status,
      scheduledAt: scheduledAt ?? null,
    };

    // Add platform relations if any
    if (platformIds.length > 0) {
      createData.platforms = {
        create: platformIds.map(platformId => ({
          platform: { connect: { id: platformId } },
          status,
        })),
      };
    }

    // Add media relations if any
    if (mediaFileIds.length > 0) {
      createData.mediaFiles = {
        create: mediaFileIds.map((mediaFileId, index) => ({
          mediaFile: { connect: { id: mediaFileId } },
          order: index,
        })),
      };
    }

    const post = await prisma.post.create({
      data: createData,
      include: postInclude,
    });

    logger.info({ postId: post.id, userId, status }, 'Post created');
    return post;
  }

  /**
   * Get a single post by ID
   */
  async getById(userId: string, postId: string): Promise<PostWithRelations | null> {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        userId,
      },
      include: postInclude,
    });

    return post;
  }

  /**
   * List posts with filters
   */
  async list(
    userId: string,
    filters: PostFilters = {},
    page = 1,
    limit = 20
  ): Promise<{ posts: PostWithRelations[]; total: number; pages: number }> {
    const where: Prisma.PostWhereInput = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate || filters.toDate) {
      where.scheduledAt = {};
      if (filters.fromDate) {
        where.scheduledAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.scheduledAt.lte = filters.toDate;
      }
    }

    if (filters.platformType) {
      where.platforms = {
        some: {
          platform: {
            type: filters.platformType,
          },
        },
      };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      posts,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a post
   */
  async update(
    userId: string,
    postId: string,
    input: UpdatePostInput
  ): Promise<PostWithRelations | null> {
    // First check if post exists and belongs to user
    const existingPost = await prisma.post.findFirst({
      where: { id: postId, userId },
    });

    if (!existingPost) {
      return null;
    }

    // Can only edit DRAFT or SCHEDULED posts
    if (!['DRAFT', 'SCHEDULED'].includes(existingPost.status)) {
      throw new Error('Cannot edit a post that is being published or already published');
    }

    const { content, scheduledAt, platformIds, mediaFileIds, status } = input;

    // Build update data
    const updateData: Prisma.PostUpdateInput = {};

    if (content !== undefined) {
      updateData.content = content;
    }

    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt;
      // Auto-update status based on scheduledAt
      if (scheduledAt && scheduledAt > new Date()) {
        updateData.status = 'SCHEDULED';
      } else if (scheduledAt === null && existingPost.status === 'SCHEDULED') {
        updateData.status = 'DRAFT';
      }
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    // Update post
    const post = await prisma.$transaction(async (tx) => {
      // Update platforms if provided
      if (platformIds !== undefined) {
        // Remove existing platforms
        await tx.postPlatform.deleteMany({ where: { postId } });
        
        // Add new platforms
        if (platformIds.length > 0) {
          await tx.postPlatform.createMany({
            data: platformIds.map(platformId => ({
              postId,
              platformId,
              status: (updateData.status as PostStatus) || existingPost.status,
            })),
          });
        }
      }

      // Update media if provided
      if (mediaFileIds !== undefined) {
        // Remove existing media
        await tx.postMedia.deleteMany({ where: { postId } });
        
        // Add new media
        if (mediaFileIds.length > 0) {
          await tx.postMedia.createMany({
            data: mediaFileIds.map((mediaFileId, index) => ({
              postId,
              mediaFileId,
              order: index,
            })),
          });
        }
      }

      // Update the post itself
      return tx.post.update({
        where: { id: postId },
        data: updateData,
        include: postInclude,
      });
    });

    logger.info({ postId, userId }, 'Post updated');
    return post;
  }

  /**
   * Delete a post
   */
  async delete(userId: string, postId: string): Promise<boolean> {
    const post = await prisma.post.findFirst({
      where: { id: postId, userId },
    });

    if (!post) {
      return false;
    }

    // Can only delete DRAFT, SCHEDULED, or FAILED posts
    if (!['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status)) {
      throw new Error('Cannot delete a post that is being published');
    }

    await prisma.post.delete({ where: { id: postId } });
    
    logger.info({ postId, userId }, 'Post deleted');
    return true;
  }

  /**
   * Schedule a post for publishing
   */
  async schedule(userId: string, postId: string, scheduledAt: Date): Promise<PostWithRelations | null> {
    const post = await prisma.post.findFirst({
      where: { id: postId, userId },
      include: { platforms: true },
    });

    if (!post) {
      return null;
    }

    if (!['DRAFT', 'SCHEDULED'].includes(post.status)) {
      throw new Error('Can only schedule draft or reschedule existing posts');
    }

    if (post.platforms.length === 0) {
      throw new Error('Please select at least one platform before scheduling');
    }

    if (scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        scheduledAt,
        status: 'SCHEDULED',
        platforms: {
          updateMany: {
            where: { postId },
            data: { status: 'SCHEDULED' },
          },
        },
      },
      include: postInclude,
    });

    logger.info({ postId, userId, scheduledAt }, 'Post scheduled');
    return updatedPost;
  }

  /**
   * Cancel a scheduled post (return to draft)
   */
  async unschedule(userId: string, postId: string): Promise<PostWithRelations | null> {
    const post = await prisma.post.findFirst({
      where: { id: postId, userId },
    });

    if (!post) {
      return null;
    }

    if (post.status !== 'SCHEDULED') {
      throw new Error('Can only unschedule scheduled posts');
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        scheduledAt: null,
        status: 'DRAFT',
        platforms: {
          updateMany: {
            where: { postId },
            data: { status: 'DRAFT' },
          },
        },
      },
      include: postInclude,
    });

    logger.info({ postId, userId }, 'Post unscheduled');
    return updatedPost;
  }

  /**
   * Get posts that are due for publishing
   */
  async getDueForPublishing(): Promise<PostWithRelations[]> {
    const posts = await prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: new Date(),
        },
      },
      include: postInclude,
    });

    return posts;
  }

  /**
   * Get post statistics for a user
   */
  async getStats(userId: string): Promise<{
    total: number;
    draft: number;
    scheduled: number;
    published: number;
    failed: number;
  }> {
    const [total, draft, scheduled, published, failed] = await Promise.all([
      prisma.post.count({ where: { userId } }),
      prisma.post.count({ where: { userId, status: 'DRAFT' } }),
      prisma.post.count({ where: { userId, status: 'SCHEDULED' } }),
      prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
      prisma.post.count({ where: { userId, status: 'FAILED' } }),
    ]);

    return { total, draft, scheduled, published, failed };
  }
}

export const postService = new PostService();
