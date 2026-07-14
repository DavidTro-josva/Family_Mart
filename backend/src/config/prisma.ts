import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as any, (e: any) => {
    logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
  });
}

export default prisma;
