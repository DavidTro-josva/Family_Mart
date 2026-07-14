import { Router, Request, Response, NextFunction } from 'express';
import {
  getSuppliersAP,
  createSupplierPayment,
  getSupplierLedger,
  getSupplierPayments,
} from '../controllers/ap.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';
import { createSupplierPaymentSchema } from '../validations/ap.validation.js';
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

// Apply JWT authentication to all accounts payable routes
router.use(authenticateJWT as any);

// Clerks, managers, and admins can view aging and supplier statements
router.get('/aging', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, getSuppliersAP as any);
router.get('/suppliers/:supplierId/ledger', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, getSupplierLedger as any);
router.get('/suppliers/:supplierId/payments', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, getSupplierPayments as any);

// Only Managers and Admins can record payments to suppliers
router.post('/payments', requireRoles(['ADMIN', 'MANAGER']) as any, validateRequest(createSupplierPaymentSchema) as any, createSupplierPayment as any);

export default router;
