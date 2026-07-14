import { Router, Request, Response, NextFunction } from 'express';
import {
  createSupplierInvoice,
  approveAndPostInvoice,
  getSupplierInvoices,
  getSupplierInvoiceDetails,
} from '../controllers/supplierInvoice.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';
import { createSupplierInvoiceSchema, approveInvoiceSchema } from '../validations/supplierInvoice.validation.js';
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

// Apply JWT authentication to all supplier invoice routes
router.use(authenticateJWT as any);

// Clerks, managers, and admins can view and create supplier invoices
router.get('/', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, getSupplierInvoices as any);
router.get('/:id', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, getSupplierInvoiceDetails as any);
router.post('/', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, validateRequest(createSupplierInvoiceSchema) as any, createSupplierInvoice as any);

// Only Managers and Admins can approve / reject / post to Accounts Payable
router.post('/:id/post', requireRoles(['ADMIN', 'MANAGER']) as any, validateRequest(approveInvoiceSchema) as any, approveAndPostInvoice as any);

export default router;
