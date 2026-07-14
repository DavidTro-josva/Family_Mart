import { z } from 'zod';
import { RefundMethod, ReturnReason, ReturnStatus, ReturnAction } from '@prisma/client';

export const createReturnSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  refundMethod: z.nativeEnum(RefundMethod, { errorMap: () => ({ message: 'Invalid refund method' }) }),
  remarks: z.string().optional().nullable(),
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantity: z.number().int().positive('Quantity must be greater than 0'),
      reason: z.nativeEnum(ReturnReason, { errorMap: () => ({ message: 'Invalid return reason' }) }),
      unitRefundAmount: z.number().nonnegative('Refund amount cannot be negative'),
    })
  ).min(1, 'Return must contain at least one item'),
});

export const processReturnSchema = z.object({
  status: z.nativeEnum(ReturnStatus, { errorMap: () => ({ message: 'Invalid return status' }) }),
  remarks: z.string().optional().nullable(),
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid item ID'),
      action: z.nativeEnum(ReturnAction, { errorMap: () => ({ message: 'Invalid return action' }) }),
    })
  ).optional().nullable(),
});
