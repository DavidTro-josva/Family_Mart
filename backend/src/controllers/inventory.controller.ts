import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import { adjustStockSchema } from '../validations/inventory.validation.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import crypto from 'crypto';
import { FifoService } from '../services/fifo.service.js';

// --- Get Inventory Dashboard Metrics ---
export const getInventoryDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stocks = await prisma.warehouseStock.findMany({
      where: {
        product: { isActive: true }
      },
      include: { product: true },
    });

    let totalCostValue = 0;
    let totalSellingValue = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    const lowStockItems: any[] = [];

    stocks.forEach((stock) => {
      const qty = stock.quantity;
      totalCostValue += qty * stock.product.costPrice;
      totalSellingValue += qty * stock.product.sellingPrice;

      if (qty === 0) {
        outOfStockCount++;
      }

      if (qty <= stock.product.reorderLevel) {
        lowStockCount++;
        lowStockItems.push({
          id: stock.id,
          productName: stock.product.name,
          barcode: stock.product.barcode,
          quantity: qty,
          reorderLevel: stock.reorderLevel,
          binCode: stock.binCode,
        });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalCostValue,
          totalSellingValue,
          outOfStockCount,
          lowStockCount,
        },
        lowStockItems: lowStockItems.slice(0, 5), // Return top 5 low stock items
        stocks: stocks.map((s) => ({
          id: s.id,
          productId: s.productId,
          productName: s.product.name,
          barcode: s.product.barcode,

          quantity: s.quantity,
          reorderLevel: s.product.reorderLevel,
          costPrice: s.product.costPrice,
          sellingPrice: s.product.sellingPrice,
          mrp: s.product.mrp,
          description: s.product.description,
          unitId: s.product.unitId,
          subCategoryId: s.product.subCategoryId,
          brandId: s.product.brandId,
          gstCategoryId: s.product.gstCategoryId,
          supplierId: s.product.supplierId,
          binCode: s.binCode,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// --- Get Chronological Stock Ledger (Transactions) ---
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { productId, warehouseId, type } = req.query;

    const where: any = {};
    if (productId) where.productId = productId as string;
    if (warehouseId) where.warehouseId = warehouseId as string;
    if (type) where.type = type as any;

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: true,
          warehouse: true,
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions,
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

// --- Perform Stock Adjustment (with Negative Stock Protection) ---
export const adjustStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = adjustStockSchema.parse(req.body);
    const { productId, warehouseId, type, quantity, binCode, reason } = validated;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get current stock (or default to 0 if not tracked yet)
      let stock = await tx.warehouseStock.findUnique({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
      });

      if (!stock) {
        stock = await tx.warehouseStock.create({
          data: {
            productId,
            warehouseId,
            quantity: 0,
            binCode: binCode || 'RECEIVING',
          },
        });
      }

      const previousStock = stock.quantity;
      let newStock = previousStock;

      // Determine sign of adjustment
      let changeQty = 0;
      if (type === 'ADJUSTMENT') {
        changeQty = quantity - previousStock;
      } else {
        changeQty = type === 'ADDITION' ? quantity : -quantity;
      }

      newStock = previousStock + changeQty;

      // 2. Enforce Negative Stock Protection
      if (newStock < 0) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // 3. Update Warehouse Stock
      const updatedStock = await tx.warehouseStock.update({
        where: { id: stock.id },
        data: {
          quantity: newStock,
          binCode: binCode || stock.binCode,
        },
        include: { product: true, warehouse: true },
      });

      // 4. Append to InventoryTransaction
      const correlationId = req.correlationId || crypto.randomUUID();
      const transaction = await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId,
          type: type as any,
          quantity: changeQty,
          previousStock,
          newStock,
          reason,
          correlationId,
          createdByUserId: req.user?.id || null,
        },
      });

      // 4.5. Manage FIFO Layers
      if (changeQty > 0) {
        await FifoService.createFifoLayer(tx, {
          productId,
          warehouseId,
          quantity: changeQty,
          unitCost: updatedStock.product.costPrice,
        });
      } else if (changeQty < 0) {
        await FifoService.consumeFifoStock(tx, {
          productId,
          warehouseId,
          quantity: Math.abs(changeQty),
          inventoryTransactionId: transaction.id,
        });
      }

      // 5. Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user?.id || null,
          eventType: `INVENTORY_${type}`,
          description: `Stock adjusted for ${updatedStock.product.name} in ${updatedStock.warehouse.name}: ${previousStock} -> ${newStock}`,
          correlationId,
          ipAddress: req.ip,
          metadata: {
            productId,
            warehouseId,
            change: changeQty,
          },
        },
      });

      return { updatedStock, transaction };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Operation rejected: Insufficient stock. Negative stock is not allowed.',
          code: 'INSUFFICIENT_STOCK',
        },
      });
    }
    next(err);
  }
};

// --- Get Warehouses ---
export const getWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json({ success: true, data: { warehouses } });
  } catch (err) {
    next(err);
  }
};

