import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
});

export const subCategorySchema = z.object({
  name: z.string().min(2, 'Subcategory name must be at least 2 characters'),
  description: z.string().optional(),
  categoryId: z.string().uuid('Invalid Category ID'),
});

export const brandSchema = z.object({
  name: z.string().min(2, 'Brand name must be at least 2 characters'),
  description: z.string().optional(),
});

export const unitSchema = z.object({
  name: z.string().min(2, 'Unit name must be at least 2 characters'),
  abbreviation: z.string().min(1, 'Abbreviation is required'),
});

export const paymentTypeSchema = z.object({
  name: z.string().min(2, 'Payment Type name must be at least 2 characters'),
  description: z.string().optional(),
});

export const bankAccountSchema = z.object({
  accountName: z.string().min(2, 'Account Name is required'),
  accountNumber: z.string().min(5, 'Account Number must be at least 5 characters'),
  bankName: z.string().min(2, 'Bank Name is required'),
  branch: z.string().optional(),
  ifscCode: z.string().optional(),
});

export const gstCategorySchema = z.object({
  name: z.string().min(2, 'GST Category name is required'),
  rate: z.number().min(0, 'GST rate cannot be negative'),
  description: z.string().optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name is required'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstIn: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
  creditPeriod: z.number().int().min(0).default(0),
  creditLimit: z.number().min(0).default(0.0),
});

export const customerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
  creditLimit: z.number().min(0).default(0.0),
});

export const employeeSchema = z.object({
  userId: z.string().uuid('Invalid User ID').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_CLERK']).optional(),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().optional().default(''),
  phone: z.string().optional(),
  designation: z.string().min(2, 'Designation is required'),
  salary: z.number().min(0).default(0.0),
  joiningDate: z.string().transform((val) => new Date(val)).optional(),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  barcode: z.string().min(3, 'Barcode is required'),

  hsnCode: z.string().optional(),
  costPrice: z.number().min(0, 'Cost price cannot be negative'),
  mrp: z.number().min(0, 'MRP cannot be negative'),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  minStock: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(0),
  openingStock: z.number().int().min(0).default(0),
  unitId: z.string().uuid('Invalid Unit ID'),
  subCategoryId: z.string().uuid('Invalid SubCategory ID'),
  brandId: z.string().uuid('Invalid Brand ID'),
  gstCategoryId: z.string().uuid('Invalid GST Category ID'),
  supplierId: z.string().uuid('Invalid Supplier ID'),
  imagePath: z.string().optional(),
}).refine((data) => data.costPrice <= data.sellingPrice, {
  message: 'Selling price must be greater than or equal to cost price',
  path: ['sellingPrice'],
}).refine((data) => data.sellingPrice <= data.mrp, {
  message: 'Selling price cannot exceed MRP',
  path: ['sellingPrice'],
});
