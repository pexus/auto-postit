import { publishQueue } from '../config/queue.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface PublishJobData {
  postId: string;
  userId: string;
}

/**
 * Find scheduled posts due for publishing and enqueue publish jobs.
 * This function uses an atomic update to mark a post as PUBLISHING
 * to avoid double-enqueue from concurrent runs.
 */
export async function scanAndEnqueueDuePosts(limit = 50): Promise<number> {
  const now = new Date();

  const duePosts = await prisma.post.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    take: limit,
  });

  let enqueued = 0;

  for (const post of duePosts) {
    try {
      // Attempt to atomically set the status to PUBLISHING only when it's still SCHEDULED
      const updated = await prisma.post.updateMany({
        where: { id: post.id, status: 'SCHEDULED' },
        data: { status: 'PUBLISHING' },
      });

      if (updated.count === 0) {
        // Another worker/process already handled this post
        continue;
      }

      // Enqueue publish job (jobId prevents duplicates)
      await publishQueue.add(
        'publish',
        { postId: post.id, userId: post.userId } as PublishJobData,
        {
          jobId: `publish-post-${post.id}`,
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      );

      enqueued++;
      logger.info({ postId: post.id }, 'Enqueued publish job');
    } catch (error) {
      logger.error({ error, postId: post.id }, 'Failed to enqueue publish job');
    }
  }

  return enqueued;
}

export async function enqueuePublishJob(postId: string, userId: string) {
  await publishQueue.add(
    'publish',
    { postId, userId } as PublishJobData,
    {
      jobId: `publish-post-${postId}`,
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}
