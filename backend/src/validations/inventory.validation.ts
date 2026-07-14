import { z } from 'zod';

export const adjustStockSchema = z.object({
  productId: z.string().uuid('Invalid Product ID'),
  warehouseId: z.string().uuid('Invalid Warehouse ID'),
  type: z.enum(['ADDITION', 'REMOVAL', 'ADJUSTMENT', 'DAMAGE', 'EXPIRY']),
  quantity: z.number().int().min(0, 'Quantity must be at least 0'),
  binCode: z.string().optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});
