import { Queue } from 'bullmq';
import { redis } from '../lib/redis.js';

// Publish queue - used to schedule and process post publishing jobs
export const publishQueue = new Queue('publish', {
  connection: redis,
});

// QueueScheduler is required for repeatable jobs and delayed jobs.
// Use dynamic require to avoid type declaration mismatches across bullmq versions.
let QueueSchedulerCtor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _Bull = require('bullmq') as any;
  // Support both CommonJS and ES module default exports
  QueueSchedulerCtor = _Bull.QueueScheduler || _Bull.default?.QueueScheduler || _Bull?.QueueScheduler;
} catch (err) {
  // If bullmq isn't available at runtime, leave scheduler undefined and worker will still function for non-repeatable jobs.
  // We intentionally don't throw here to avoid hard crashing when running certain tasks locally without redis/bullmq installed.
  // eslint-disable-next-line no-console
  console.warn('bullmq QueueScheduler not available:', (err as any)?.message || err);
}

export const publishQueueScheduler = QueueSchedulerCtor
  ? new QueueSchedulerCtor('publish', {
      connection: redis,
    })
  : undefined;
