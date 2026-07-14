import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
  correlationId?: string;
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_ACCESS_SECRET || 'super_secret_access_key_123!@#';

    jwt.verify(token, secret, (err, decoded: any) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Invalid or expired access token',
            code: 'INVALID_TOKEN',
          },
        });
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role as Role,
      };
      next();
    });
  } else {
    res.status(401).json({
      success: false,
      error: {
        message: 'Authorization header is missing or invalid',
        code: 'UNAUTHORIZED',
      },
    });
  }
};

export const requireRoles = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User is not authenticated',
          code: 'UNAUTHORIZED',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'You do not have permission to perform this action',
          code: 'FORBIDDEN',
        },
      });
    }

    next();
  };
};

export const attachCorrelationId = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  req.correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
};
