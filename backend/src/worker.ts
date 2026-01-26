import { Worker, Job } from 'bullmq';
import { publishQueue } from './config/queue.js';
import { scanAndEnqueueDuePosts } from './jobs/publish.job.js';
import { publishService } from './services/publish.service.js';
import { redis } from './lib/redis.js';
import { logger } from './lib/logger.js';

async function ensureScannerJob() {
  try {
    // Add a repeatable "scan" job that runs every minute to find due posts
    await publishQueue.add(
      'scan',
      {},
      {
        jobId: 'scan-due-posts',
        repeat: { every: 60_000 }, // every minute
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );
    logger.info('Scheduled scan job (every 1 minute)');
  } catch (error) {
    // If a repeatable job already exists, Bull will throw - ignore
    logger.info({ error }, 'Could not create repeatable scan job (may already exist)');
  }
}

export async function startWorker() {
  // Ensure the QueueScheduler is initialized (it was imported in config)
  // Create worker processor
  const worker = new Worker(
    'publish',
    async (job: Job) => {
      logger.info({ jobName: job.name }, 'Processing job');

      if (job.name === 'scan') {
        const count = await scanAndEnqueueDuePosts();
        logger.info({ count }, 'Scan complete - enqueued jobs');
        return { enqueued: count };
      }

      if (job.name === 'publish') {
        const { postId, userId } = job.data as { postId: string; userId: string };
        logger.info({ postId, userId }, 'Starting publish job');
        try {
          const results = await publishService.publishNow(userId, postId);
          logger.info({ postId, results }, 'Publish job complete');
          return { results };
        } catch (error) {
          logger.error({ error, postId }, 'Publish job failed');
          throw error;
        }
      }

      throw new Error(`Unknown job name: ${job.name}`);
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  await ensureScannerJob();

  logger.info('Worker started');
}

// Run worker when worker.ts is executed directly
if (require.main === module) {
  startWorker().catch((err) => {
    logger.error({ err }, 'Worker failed to start');
    process.exit(1);
  });
}
