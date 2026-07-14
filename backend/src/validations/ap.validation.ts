import { z } from 'zod';
import { SupplierPaymentMethod } from '@prisma/client';

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.nativeEnum(SupplierPaymentMethod, { errorMap: () => ({ message: 'Invalid payment method' }) }),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  invoiceId: z.string().uuid('Invalid invoice ID').optional().nullable(),
});
