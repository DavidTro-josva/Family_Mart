import { Router, Request, Response, NextFunction } from 'express';
import {
  createPO,
  updatePOStatus,
  getPOs,
  getPODetails,
  updateSupplierDetails,
  getProcurementMetrics,
} from '../controllers/procurement.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';
import {
  createPOSchema,
  updatePOStatusSchema,
  updateSupplierSchema,
} from '../validations/procurement.validation.js';
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

// Apply JWT authentication to all procurement routes
router.use(authenticateJWT as any);

// Metrics
router.get(
  '/metrics',
  requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any,
  getProcurementMetrics as any
);

// Purchase Orders
router.get(
  '/pos',
  requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any,
  getPOs as any
);

router.get(
  '/pos/:id',
  requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any,
  getPODetails as any
);

router.post(
  '/pos',
  requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any,
  validateRequest(createPOSchema) as any,
  createPO as any
);

router.patch(
  '/pos/:id/status',
  requireRoles(['ADMIN', 'MANAGER']) as any,
  validateRequest(updatePOStatusSchema) as any,
  updatePOStatus as any
);

// Suppliers (Extended Fields Update)
router.patch(
  '/suppliers/:id',
  requireRoles(['ADMIN', 'MANAGER']) as any,
  validateRequest(updateSupplierSchema) as any,
  updateSupplierDetails as any
);

export default router;
