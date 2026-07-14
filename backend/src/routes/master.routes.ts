import { Router } from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  createSubCategory,
  getBrands,
  createBrand,
  getUnits,
  createUnit,
  getGstCategories,
  createGstCategory,
  getSuppliers,
  createSupplier,
  getCustomers,
  createCustomer,
  getEmployees,
  createEmployee,
  deleteEmployee,
  getPaymentTypes,
  createPaymentType,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  updateEmployee
} from '../controllers/master.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication to all master data routes
router.use(authenticateJWT as any);

// --- Products ---
router.get('/products', getProducts);
router.post('/products', requireRoles(['ADMIN', 'MANAGER']) as any, createProduct);
router.put('/products/:id', requireRoles(['ADMIN', 'MANAGER']) as any, updateProduct);
router.delete('/products/:id', requireRoles(['ADMIN', 'MANAGER']) as any, deleteProduct);

// --- Categories & Subcategories ---
router.get('/categories', getCategories);
router.post('/categories', requireRoles(['ADMIN', 'MANAGER']) as any, createCategory);
router.post('/subcategories', requireRoles(['ADMIN', 'MANAGER']) as any, createSubCategory);

// --- Brands, Units, GST ---
router.get('/brands', getBrands);
router.post('/brands', requireRoles(['ADMIN', 'MANAGER']) as any, createBrand);

router.get('/units', getUnits);
router.post('/units', requireRoles(['ADMIN', 'MANAGER']) as any, createUnit);

router.get('/gst-categories', getGstCategories);
router.post('/gst-categories', requireRoles(['ADMIN', 'MANAGER']) as any, createGstCategory);

// --- Payment Types & Bank Accounts ---
router.get('/payment-types', getPaymentTypes);
router.post('/payment-types', requireRoles(['ADMIN', 'MANAGER']) as any, createPaymentType);

router.get('/bank-accounts', getBankAccounts);
router.post('/bank-accounts', requireRoles(['ADMIN', 'MANAGER']) as any, createBankAccount);
router.put('/bank-accounts/:id', requireRoles(['ADMIN', 'MANAGER']) as any, updateBankAccount);

// --- Suppliers ---
router.get('/suppliers', getSuppliers);
router.post('/suppliers', requireRoles(['ADMIN', 'MANAGER']) as any, createSupplier);

// --- Customers ---
router.get('/customers', getCustomers);
router.post('/customers', requireRoles(['ADMIN', 'MANAGER', 'CASHIER']) as any, createCustomer);

// --- Employees ---
router.get('/employees', getEmployees);
router.post('/employees', requireRoles(['ADMIN']) as any, createEmployee);
router.put('/employees/:id', requireRoles(['ADMIN']) as any, updateEmployee);
router.delete('/employees/:id', requireRoles(['ADMIN']) as any, deleteEmployee);

export default router;
