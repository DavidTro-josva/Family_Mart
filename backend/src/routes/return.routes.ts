import { Router, Request, Response, NextFunction } from 'express';
import {
  createReturn,
  processReturn,
  getReturns,
  getReturnDetails,
} from '../controllers/return.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';
import { createReturnSchema, processReturnSchema } from '../validations/return.validation.js';
import { z } from 'zod';

const router = Router();

// Validation middleware
const validateRequest = (schema: z.ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        },
      });
    }
  };
};

// Apply JWT authentication to all return routes
router.use(authenticateJWT as any);

// Cashiers, clerks, managers, and admins can view and create returns
router.get('/', requireRoles(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK']) as any, getReturns as any);
router.get('/:id', requireRoles(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK']) as any, getReturnDetails as any);
router.post('/', requireRoles(['ADMIN', 'MANAGER', 'CASHIER']) as any, validateRequest(createReturnSchema) as any, createReturn as any);

// Only Managers and Admins can process (approve/reject/reconcile) returns
router.post('/:id/process', requireRoles(['ADMIN', 'MANAGER']) as any, validateRequest(processReturnSchema) as any, processReturn as any);

export default router;
