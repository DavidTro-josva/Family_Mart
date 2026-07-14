import { z } from 'zod';
import { ReceiptItemStatus } from '@prisma/client';

export const createGRNSchema = z.object({
  purchaseOrderId: z.string().uuid('Invalid purchase order ID').optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  remarks: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantityOrdered: z.number().int().nonnegative('Quantity ordered cannot be negative').default(0),
      quantityReceived: z.number().int().positive('Quantity received must be greater than 0'),
    })
  ).min(1, 'Receipt must contain at least one item'),
});

export const inspectGRNSchema = z.object({
  remarks: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid item ID'),
      quantityAccepted: z.number().int().nonnegative('Quantity accepted cannot be negative'),
      quantityRejected: z.number().int().nonnegative('Quantity rejected cannot be negative'),
      status: z.nativeEnum(ReceiptItemStatus, { errorMap: () => ({ message: 'Invalid item inspection status' }) }),
      binCode: z.string().optional().nullable(),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'Must inspect at least one item'),
});
