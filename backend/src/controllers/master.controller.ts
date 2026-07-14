import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import {
  categorySchema,
  subCategorySchema,
  brandSchema,
  unitSchema,
  gstCategorySchema,
  supplierSchema,
  customerSchema,
  employeeSchema,
  productSchema,
  paymentTypeSchema,
  bankAccountSchema
} from '../validations/master.validation.js';

// --- Helper: Pagination & Response ---
const getPagination = (req: Request) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ==========================================
// 1. PRODUCT CONTROLLER
// ==========================================
export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { search, categoryId, brandId, supplierId } = req.query;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { barcode: { contains: search as string } },

      ];
    }

    if (categoryId) {
      where.subCategory = { categoryId: categoryId as string };
    }

    if (brandId) {
      where.brandId = brandId as string;
    }

    if (supplierId) {
      where.supplierId = supplierId as string;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          unit: true,
          subCategory: { include: { category: true } },
          brand: true,
          gstCategory: true,
          supplier: true,
          warehouseStocks: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = productSchema.parse(req.body);

    const existingProduct = await prisma.product.findFirst({
      where: {
        barcode: validated.barcode,
      },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Product with this barcode already exists',
          code: 'DUPLICATE_PRODUCT',
        },
      });
    }

    const product = await prisma.$transaction(async (tx) => {


      // Check if product already exists inside transaction to prevent race conditions
      const existing = await tx.product.findFirst({
        where: {
          barcode: validated.barcode,
        },
      });

      if (existing) {
        throw new Error('DUPLICATE_PRODUCT');
      }

      const p = await tx.product.create({
        data: {
          ...validated,

        },
        include: {
          unit: true,
          subCategory: { include: { category: true } },
          brand: true,
          gstCategory: true,
          supplier: true,
        },
      });

      // Find or create WH-MAIN
      let warehouse = await tx.warehouse.findFirst({
        where: { code: 'WH-MAIN' },
      });

      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: {
            name: 'Main Store Warehouse',
            code: 'WH-MAIN',
            address: 'Family Mart Main Store',
          },
        });
      }

      // Create WarehouseStock and FifoLayer if openingStock is provided
      if (validated.openingStock && validated.openingStock > 0) {
        await tx.warehouseStock.create({
          data: {
            productId: p.id,
            warehouseId: warehouse.id,
            quantity: validated.openingStock,
          },
        });

        await tx.fifoLayer.create({
          data: {
            productId: p.id,
            warehouseId: warehouse.id,
            originalQuantity: validated.openingStock,
            remainingQuantity: validated.openingStock,
            unitCost: p.costPrice || 0,
            landedCost: p.costPrice || 0,
          },
        });
      }

      return p;
    }, { maxWait: 10000, timeout: 30000 });

    res.status(201).json({
      success: true,
      data: { product },
    });
  } catch (err: any) {
    if (err.message === 'DUPLICATE_PRODUCT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Product with this barcode already exists',
          code: 'DUPLICATE_PRODUCT',
        },
      });
    }
    next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = productSchema.parse(req.body);

    const existingProduct = await prisma.product.findFirst({
      where: {
        id: { not: id },
        barcode: validated.barcode,
      },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Another product with this barcode already exists',
          code: 'DUPLICATE_PRODUCT',
        },
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: validated,
      include: {
        unit: true,
        subCategory: { include: { category: true } },
        brand: true,
        gstCategory: true,
        supplier: true,
      },
    });

    res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // Soft delete
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. CATEGORY CONTROLLER
// ==========================================
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      include: { subCategories: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: validated });
    res.status(201).json({ success: true, data: { category } });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. SUBCATEGORY CONTROLLER
// ==========================================
export const createSubCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = subCategorySchema.parse(req.body);
    const subCategory = await prisma.subCategory.create({ data: validated });
    res.status(201).json({ success: true, data: { subCategory } });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. BRAND, UNIT, GST CONTROLLER
// ==========================================
export const getBrands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json({ success: true, data: { brands } });
  } catch (err) {
    next(err);
  }
};

export const createBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = brandSchema.parse(req.body);
    const brand = await prisma.brand.create({ data: validated });
    res.status(201).json({ success: true, data: { brand } });
  } catch (err) {
    next(err);
  }
};

export const getUnits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const units = await prisma.unit.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json({ success: true, data: { units } });
  } catch (err) {
    next(err);
  }
};

export const createUnit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = unitSchema.parse(req.body);
    const unit = await prisma.unit.create({ data: validated });
    res.status(201).json({ success: true, data: { unit } });
  } catch (err) {
    next(err);
  }
};

export const getGstCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gstCategories = await prisma.gstCategory.findMany({ orderBy: { rate: 'asc' } });
    res.status(200).json({ success: true, data: { gstCategories } });
  } catch (err) {
    next(err);
  }
};

export const createGstCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = gstCategorySchema.parse(req.body);
    const gstCategory = await prisma.gstCategory.create({ data: validated });
    res.status(201).json({ success: true, data: { gstCategory } });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// NEW MASTERS (PaymentType, BankAccount)
// ==========================================

export const getPaymentTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paymentTypes = await prisma.paymentType.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json({ success: true, data: { paymentTypes } });
  } catch (err) {
    next(err);
  }
};

export const createPaymentType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = paymentTypeSchema.parse(req.body);
    const paymentType = await prisma.paymentType.create({ data: validated });
    res.status(201).json({ success: true, data: { paymentType } });
  } catch (err) {
    next(err);
  }
};

export const getBankAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bankAccounts = await prisma.bankAccount.findMany({ orderBy: { accountName: 'asc' } });
    res.status(200).json({ success: true, data: { bankAccounts } });
  } catch (err) {
    next(err);
  }
};

export const createBankAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = bankAccountSchema.parse(req.body);
    const bankAccount = await prisma.bankAccount.create({ data: validated });
    res.status(201).json({ success: true, data: { bankAccount } });
  } catch (err) {
    next(err);
  }
};

export const updateBankAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = bankAccountSchema.partial().parse(req.body);
    const bankAccount = await prisma.bankAccount.update({
      where: { id },
      data: validated,
    });
    res.status(200).json({ success: true, data: { bankAccount } });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. SUPPLIER CONTROLLER
// ==========================================
export const getSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { search } = req.query;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { contactName: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        suppliers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data: validated });
    res.status(201).json({ success: true, data: { supplier } });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. CUSTOMER CONTROLLER
// ==========================================
export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { search } = req.query;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.customer.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        customers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({ data: validated });
    res.status(201).json({ success: true, data: { customer } });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. EMPLOYEE CONTROLLER
// ==========================================
export const getEmployees = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { search } = req.query;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { firstName: { contains: search as string } },
        { lastName: { contains: search as string } },
        { designation: { contains: search as string } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              username: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { firstName: 'asc' },
      }),
      prisma.employee.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        employees,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = employeeSchema.parse(req.body);
    const { userId, username, email, password, role, firstName, lastName, phone, designation, salary, joiningDate } = validated;

    let finalUserId = userId;

    if (!finalUserId) {
      if (!username || !email || !password || !role) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'To create a new employee, you must provide username, email, password, and role, or a valid userId',
            code: 'MISSING_USER_DETAILS',
          },
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { email }],
        },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'User with this username or email already exists',
            code: 'USER_ALREADY_EXISTS',
          },
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          role,
        },
      });

      finalUserId = newUser.id;
    }

    const employee = await prisma.employee.create({
      data: {
        userId: finalUserId,
        firstName,
        lastName,
        phone,
        designation,
        salary,
        joiningDate: joiningDate || new Date(),
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });
    res.status(201).json({ success: true, data: { employee } });
  } catch (err) {
    next(err);
  }
};

export const updateEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = employeeSchema.parse(req.body);
    const { username, email, password, role, firstName, lastName, phone, designation, salary, joiningDate } = validated;

    // Find existing employee
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      return res.status(404).json({ success: false, error: { message: 'Employee not found' } });
    }

    // Update User if needed
    if (username || email || role || password) {
      const userUpdateData: any = {};
      if (username) userUpdateData.username = username;
      if (email) userUpdateData.email = email;
      if (role) userUpdateData.role = role;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        userUpdateData.passwordHash = await bcrypt.hash(password, salt);
      }
      
      await prisma.user.update({
        where: { id: employee.userId },
        data: userUpdateData
      });
    }

    // Update Employee
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        firstName,
        lastName,
        phone,
        designation,
        salary,
        ...(joiningDate && { joiningDate })
      },
      include: {
        user: {
          select: { username: true, email: true, role: true }
        }
      }
    });

    res.status(200).json({ success: true, data: { employee: updatedEmployee } });
  } catch (err) {
    next(err);
  }
};

export const deleteEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

