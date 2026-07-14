import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.header('Idempotency-Key');

  // If no idempotency key, proceed normally
  if (!key) {
    return next();
  }

  try {
    // Check if key already exists in DB
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      logger.info(`Idempotency hit for key: ${key}`);
      const cachedResponse = existing.response as { status: number; body: any };
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    // Intercept res.json to cache the response before sending it
    const originalJson = res.json;

    res.json = function (body: any): Response {
      // Only cache successful or client-error responses, avoid caching server errors (5xx)
      if (res.statusCode >= 200 && res.statusCode < 500) {
        prisma.idempotencyKey.create({
          data: {
            key,
            response: {
              status: res.statusCode,
              body,
            },
          },
        }).catch(err => {
          logger.error(`Failed to save idempotency key: ${err.message}`);
        });
      }

      return originalJson.call(this, body);
    };

    next();
  } catch (error: any) {
    logger.error(`Idempotency middleware error: ${error.message}`);
    next();
  }
};
