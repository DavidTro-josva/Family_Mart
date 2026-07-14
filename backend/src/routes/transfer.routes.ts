import { Router, Request, Response, NextFunction } from 'express';
import {
  createTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  getTransfers,
  getTransferDetails,
} from '../controllers/transfer.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';
import {
  createTransferSchema,
  dispatchTransferSchema,
  receiveTransferSchema,
} from '../validations/transfer.validation.js';
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

// Apply JWT authentication to all transfer routes
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any);

router.get('/', getTransfers as any);
router.get('/:id', getTransferDetails as any);
router.post('/', validateRequest(createTransferSchema) as any, createTransfer as any);
router.post('/:id/approve', approveTransfer as any);
router.post('/:id/dispatch', validateRequest(dispatchTransferSchema) as any, dispatchTransfer as any);
router.post('/:id/receive', validateRequest(receiveTransferSchema) as any, receiveTransfer as any);

export default router;
