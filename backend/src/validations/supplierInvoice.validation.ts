import { z } from 'zod';
import { SupplierInvoiceStatus } from '@prisma/client';

export const createSupplierInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().datetime({ message: 'Invalid invoice date' }),
  dueDate: z.string().datetime({ message: 'Invalid due date' }),
  supplierId: z.string().uuid('Invalid supplier ID'),
  purchaseOrderId: z.string().uuid('Invalid PO ID').optional().nullable(),
  goodsReceiptId: z.string().uuid('Invalid GRN ID').optional().nullable(),
  subTotal: z.number().positive('Subtotal must be greater than 0'),
  taxAmount: z.number().nonnegative('Tax amount cannot be negative'),
  grandTotal: z.number().positive('Grand total must be greater than 0'),
  remarks: z.string().optional().nullable(),
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantity: z.number().int().positive('Quantity must be greater than 0'),
      unitPrice: z.number().positive('Unit price must be greater than 0'),
      taxAmount: z.number().nonnegative('Tax amount cannot be negative'),
      total: z.number().positive('Total must be greater than 0'),
    })
  ).min(1, 'Invoice must contain at least one item'),
});

export const approveInvoiceSchema = z.object({
  status: z.nativeEnum(SupplierInvoiceStatus, { errorMap: () => ({ message: 'Invalid status' }) }),
  remarks: z.string().optional().nullable(),
});
