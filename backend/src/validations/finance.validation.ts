import { z } from 'zod';

export const openRegisterSchema = z.object({
  openingFloat: z.number().min(0, 'Opening float cannot be negative').default(0),
});

export const closeRegisterSchema = z.object({
  actualCash: z.number().min(0, 'Actual cash cannot be negative'),
  notes: z.string().optional(),
});

export const regTransactionSchema = z.object({
  type: z.enum(['CASH_IN', 'CASH_OUT', 'SAFE_DROP']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(3, 'Description is required'),
});

export const customerPaymentSchema = z.object({
  customerId: z.string().uuid('Invalid Customer ID'),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().optional(),
});
