import { z } from 'zod';
import { POStatus, SupplierStatus } from '@prisma/client';

export const createPOSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  expectedDeliveryDate: z.string().datetime('Invalid delivery date format').or(z.date()),
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantity: z.number().int().positive('Quantity must be greater than 0'),
      unitCost: z.number().nonnegative('Unit cost cannot be negative'),
      taxRate: z.number().nonnegative('Tax rate cannot be negative').default(0.0),
      discountAmount: z.number().nonnegative('Discount amount cannot be negative').default(0.0),
      remarks: z.string().optional(),
    })
  ).min(1, 'Purchase order must contain at least one item'),
});

export const updatePOStatusSchema = z.object({
  status: z.nativeEnum(POStatus, { errorMap: () => ({ message: 'Invalid PO status' }) }),
  approvalComments: z.string().optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').optional(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  gstIn: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  creditPeriod: z.number().int().nonnegative('Credit period cannot be negative').optional(),
  creditLimit: z.number().nonnegative('Credit limit cannot be negative').optional(),
  category: z.string().optional(),
  bankDetails: z.record(z.any()).optional(),
  defaultCurrency: z.string().optional(),
  status: z.nativeEnum(SupplierStatus).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
