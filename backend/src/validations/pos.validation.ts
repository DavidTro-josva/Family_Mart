import { z } from 'zod';

export const checkoutItemSchema = z.object({
  productId: z.string().uuid('Invalid Product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
});

export const checkoutSchema = z.object({
  customerId: z.string().uuid('Invalid Customer ID').optional().nullable(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'SPLIT']),
  paymentDetails: z.any().optional(),
  discount: z.number().min(0, 'Global discount cannot be negative').default(0),
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required for checkout'),
});
