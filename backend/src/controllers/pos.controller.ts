import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import { checkoutSchema } from '../validations/pos.validation.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import crypto from 'crypto';
import { FifoService } from '../services/fifo.service.js';

// --- POS Checkout Transaction ---
export const checkout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = checkoutSchema.parse(req.body);
    const { customerId, paymentMethod, paymentDetails, discount: globalDiscount, items } = validated;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get or create the default warehouse
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

      // 2. Fetch customer if provided
      let customer = null;
      if (customerId) {
        customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer || !customer.isActive) {
          throw new Error('INVALID_CUSTOMER');
        }
      }

      let invoiceSubTotal = 0;
      let invoiceTaxAmount = 0;
      let invoiceDiscount = globalDiscount;

      const invoiceItemsData: any[] = [];
      const stockUpdates: any[] = [];

      // 3. Process each item
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { gstCategory: true },
        });

        if (!product || !product.isActive) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
        }

        // Get Stock in default warehouse
        const stock = await tx.warehouseStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: product.id,
              warehouseId: warehouse.id,
            },
          },
        });

        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        // Calculations
        const unitPrice = product.sellingPrice;
        const subTotal = unitPrice * item.quantity;
        const gstRate = product.gstCategory.rate;
        const gstAmount = (subTotal * gstRate) / 100;
        const total = subTotal + gstAmount - item.discount;

        invoiceSubTotal += subTotal;
        invoiceTaxAmount += gstAmount;
        invoiceDiscount += item.discount;

        invoiceItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          costPrice: product.costPrice,
          gstRate,
          gstAmount,
          discount: item.discount,
          total,
        });

        // Queue stock updates
        stockUpdates.push({
          stockId: stock.id,
          previousStock: stock.quantity,
          newStock: stock.quantity - item.quantity,
          quantity: item.quantity,
          productId: product.id,
        });
      }

      const invoiceGrandTotal = invoiceSubTotal + invoiceTaxAmount - invoiceDiscount;

      // 4. Credit Limit Check (If paymentMethod is Credit or Customer profile is used)
      // If paymentMethod is split or there's outstanding credit, we'll check it.
      // We'll assume CARD/UPI/CASH are immediate payments. SPLIT might contain credit.
      // E.g., if paymentMethod is SPLIT and paymentDetails contains a credit amount,
      // or if paymentMethod is specifically credit (we'll treat UPI/CARD/CASH as immediate, and if customer has credit limit we can allow it)
      const creditAmount = paymentDetails?.creditAmount || 0;
      if (creditAmount > 0 && customer) {
        if (customer.outstandingBalance + creditAmount > customer.creditLimit) {
          throw new Error('CREDIT_LIMIT_EXCEEDED');
        }
        // Update customer outstanding balance
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            outstandingBalance: customer.outstandingBalance + creditAmount,
          },
        });
      }

      // 5. Deduct Stock and create Inventory Transactions
      const correlationId = req.correlationId || crypto.randomUUID();
      const txsMap = new Map<string, string>();
      for (const update of stockUpdates) {
        await tx.warehouseStock.update({
          where: { id: update.stockId },
          data: { quantity: update.newStock },
        });

        const invTx = await tx.inventoryTransaction.create({
          data: {
            productId: update.productId,
            warehouseId: warehouse.id,
            type: 'SALE',
            quantity: -update.quantity,
            previousStock: update.previousStock,
            newStock: update.newStock,
            reason: `POS Sale - Invoice Checkout`,
            correlationId,
            createdByUserId: req.user?.id || null,
          },
        });
        txsMap.set(update.productId, invTx.id);
      }

      // 6. Generate unique Invoice Number (e.g. INV-YYYYMMDD-XXXX)
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const invoiceCount = await tx.invoice.count({
        where: {
          invoiceNumber: { startsWith: `INV-${todayStr}` },
        },
      });
      const suffix = String(invoiceCount + 1).padStart(4, '0');
      const invoiceNumber = `INV-${todayStr}-${suffix}`;

      // 7. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: customerId || null,
          subTotal: invoiceSubTotal,
          discount: invoiceDiscount,
          taxAmount: invoiceTaxAmount,
          grandTotal: invoiceGrandTotal,
          paymentMethod: paymentMethod as any,
          paymentDetails: paymentDetails || {},
          cashierId: req.user!.id,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          cashier: { select: { username: true } },
        },
      });

      // 7.5. Consume FIFO stock and update costPrice on Invoice Items
      for (const invoiceItem of invoice.items) {
        const invTxId = txsMap.get(invoiceItem.productId);
        const totalCost = await FifoService.consumeFifoStock(tx, {
          productId: invoiceItem.productId,
          warehouseId: warehouse.id,
          quantity: invoiceItem.quantity,
          invoiceItemId: invoiceItem.id,
          inventoryTransactionId: invTxId || null,
        });

        const averageCost = totalCost / invoiceItem.quantity;
        await tx.invoiceItem.update({
          where: { id: invoiceItem.id },
          data: { costPrice: averageCost },
        });
      }

      // 8. Log Business Audit Event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id || null,
          eventType: 'SALE_CHECKOUT',
          description: `Invoice ${invoiceNumber} created. Grand Total: $${invoiceGrandTotal.toFixed(2)}`,
          correlationId,
          ipAddress: req.ip,
          metadata: {
            invoiceId: invoice.id,
            grandTotal: invoiceGrandTotal,
          },
        },
      });

      return invoice;
    }, { maxWait: 10000, timeout: 30000 });

    res.status(201).json({
      success: true,
      data: { invoice: result },
    });
  } catch (err: any) {
    if (err.message.startsWith('PRODUCT_NOT_FOUND:')) {
      const prodId = err.message.split(':')[1];
      return res.status(404).json({
        success: false,
        error: { message: `Product not found or inactive: ${prodId}`, code: 'PRODUCT_NOT_FOUND' },
      });
    }
    if (err.message.startsWith('INSUFFICIENT_STOCK:')) {
      const prodName = err.message.split(':')[1];
      return res.status(400).json({
        success: false,
        error: { message: `Insufficient stock for product: ${prodName}`, code: 'INSUFFICIENT_STOCK' },
      });
    }
    if (err.message === 'CREDIT_LIMIT_EXCEEDED') {
      return res.status(400).json({
        success: false,
        error: { message: 'Customer credit limit exceeded.', code: 'CREDIT_LIMIT_EXCEEDED' },
      });
    }
    if (err.message === 'INVALID_CUSTOMER') {
      return res.status(400).json({
        success: false,
        error: { message: 'Selected customer profile is invalid or inactive.', code: 'INVALID_CUSTOMER' },
      });
    }
    next(err);
  }
};

// --- Get Invoices History ---
export const getInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { search } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search as string } },
        { customer: { name: { contains: search as string } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: { include: { product: true } },
          customer: true,
          cashier: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        invoices,
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

