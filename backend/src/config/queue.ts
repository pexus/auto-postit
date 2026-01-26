import { Queue, QueueScheduler } from 'bullmq';
import { redis } from '../lib/redis.js';

// Publish queue - used to schedule and process post publishing jobs
export const publishQueue = new Queue('publish', {
  connection: redis,
});

// QueueScheduler is required for repeatable jobs and delayed jobs
export const publishQueueScheduler = new QueueScheduler('publish', {
  connection: redis,
});
