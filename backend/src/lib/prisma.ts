import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('query' as never, (e: { query: string; duration: number }) => {
  logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Prisma Query');
});

prisma.$on('error' as never, (e: { message: string }) => {
  logger.error({ message: e.message }, 'Prisma Error');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
