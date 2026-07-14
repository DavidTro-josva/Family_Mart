import { z } from 'zod';

export const createTransferSchema = z.object({
  sourceWarehouseId: z.string().uuid('Invalid source warehouse ID'),
  destinationWarehouseId: z.string().uuid('Invalid destination warehouse ID'),
  remarks: z.string().optional().nullable(),
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantityRequested: z.number().int().positive('Quantity requested must be greater than 0'),
    })
  ).min(1, 'Transfer request must contain at least one item'),
}).refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
  message: 'Source and destination warehouses cannot be the same',
  path: ['destinationWarehouseId'],
});

export const dispatchTransferSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid item ID'),
      quantityDispatched: z.number().int().nonnegative('Quantity dispatched cannot be negative'),
    })
  ).min(1, 'Must dispatch at least one item'),
});

export const receiveTransferSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid item ID'),
      quantityReceived: z.number().int().nonnegative('Quantity received cannot be negative'),
      quantityDamaged: z.number().int().nonnegative('Quantity damaged cannot be negative'),
      quantityLost: z.number().int().nonnegative('Quantity lost cannot be negative'),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'Must receive at least one item'),
});
