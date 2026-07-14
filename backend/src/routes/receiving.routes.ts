import { Router, Request, Response, NextFunction } from 'express';
import {
  createGRN,
  getGRNs,
  getGRNDetails,
  inspectGRN,
  completeGRN,
} from '../controllers/receiving.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';
import { createGRNSchema, inspectGRNSchema } from '../validations/receiving.validation.js';
import { AnyZodObject } from 'zod';

const router = Router();

// Validation middleware
const validateRequest = (schema: AnyZodObject) => {
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

// Apply JWT authentication to all receiving routes
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any);

// Goods Receipt Note (GRN) routes
router.get('/grns', getGRNs as any);
router.get('/grns/:id', getGRNDetails as any);
router.post('/grns', validateRequest(createGRNSchema) as any, createGRN as any);
router.post('/grns/:id/inspect', validateRequest(inspectGRNSchema) as any, inspectGRN as any);
router.post('/grns/:id/complete', completeGRN as any);

export default router;
