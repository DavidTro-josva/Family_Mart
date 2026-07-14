import { Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;

    const { userId, eventType, startDate, endDate, search } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (eventType) {
      where.eventType = eventType as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        // Set end date to end of that day (23:59:59.999)
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search as string } },
        { correlationId: { contains: search as string } },
        { ipAddress: { contains: search as string } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { username: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getEventTypes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.auditLog.findMany({
      select: { eventType: true },
      distinct: ['eventType'],
    });

    res.status(200).json({
      success: true,
      data: {
        eventTypes: types.map((t) => t.eventType),
      },
    });
  } catch (err) {
    next(err);
  }
};

