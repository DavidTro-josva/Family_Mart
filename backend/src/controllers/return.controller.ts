import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { ReturnStatus, RefundMethod, ReturnAction, TransactionType, LedgerEntryType, RegTxType, RegisterStatus } from '@prisma/client';
import { FifoService } from '../services/fifo.service.js';

/**
 * Helper to generate Return Number: RMA-YYYYMMDD-XXXX
 */
async function generateReturnNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.customerReturn.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return `RMA-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
}

/**
 * Create a new Customer Return Request (RMA)
 */
export const createReturn = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { invoiceId, warehouseId, refundMethod, remarks, items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });

    if (!invoice) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invoice not found', code: 'INVALID_INVOICE' },
      });
    }

    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || !warehouse.isActive) {
      return res.status(400).json({
        success: false,
        error: { message: 'Warehouse is invalid or inactive', code: 'INVALID_WAREHOUSE' },
      });
    }

    // Validate return quantities against invoice
    let calculatedRefundAmount = 0;
    for (const item of items) {
      const invoiceItem = invoice.items.find(i => i.productId === item.productId);
      if (!invoiceItem) {
        return res.status(400).json({
          success: false,
          error: { message: `Product ${item.productId} was not purchased in the original invoice`, code: 'PRODUCT_NOT_IN_INVOICE' },
        });
      }

      if (item.quantity > invoiceItem.quantity) {
        return res.status(400).json({
          success: false,
          error: { message: `Return quantity (${item.quantity}) exceeds purchased quantity (${invoiceItem.quantity}) for product ${invoiceItem.id}`, code: 'EXCEEDED_QUANTITY' },
        });
      }

      calculatedRefundAmount += item.quantity * item.unitRefundAmount;
    }

    const returnNumber = await generateReturnNumber();
    const correlationId = req.correlationId || 'RMA_CREATE';

    const newReturn = await prisma.$transaction(async (tx) => {
      const ret = await tx.customerReturn.create({
        data: {
          returnNumber,
          invoiceId,
          customerId: invoice.customerId || null,
          warehouseId,
          status: ReturnStatus.PENDING_INSPECTION,
          refundMethod,
          refundAmount: calculatedRefundAmount,
          createdById: userId,
          remarks: remarks || null,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              reason: item.reason,
              action: ReturnAction.RETURN_TO_STOCK, // Default action before processing
              unitRefundAmount: item.unitRefundAmount,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'RMA_CREATE',
          description: `Created Return Request ${returnNumber} for Invoice ${invoice.invoiceNumber}`,
          correlationId,
          metadata: {
            returnId: ret.id,
            returnNumber,
            invoiceId,
          },
        },
      });

      return ret;
    });

    logger.info(`Customer Return ${returnNumber} requested by user ${userId}`);

    return res.status(201).json({
      success: true,
      data: newReturn,
    });
  } catch (error: any) {
    logger.error(`Failed to create Customer Return: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to request customer return', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Process/Complete Customer Return (RMA Inspection, Stock Receipt, Refund Release)
 */
export const processReturn = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks, items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const ret = await prisma.customerReturn.findUnique({
      where: { id },
      include: {
        items: true,
        invoice: {
          include: { items: true },
        },
      },
    });

    if (!ret) {
      return res.status(404).json({
        success: false,
        error: { message: 'Customer Return not found', code: 'NOT_FOUND' },
      });
    }

    if (ret.status !== ReturnStatus.PENDING_INSPECTION) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot process return in ${ret.status} status`, code: 'INVALID_STATUS' },
      });
    }

    const correlationId = req.correlationId || 'RMA_PROCESS';

    const processed = await prisma.$transaction(async (tx) => {
      if (status === ReturnStatus.COMPLETED) {
        // 1. Process each item: update stock and create FIFO layers if returning to stock
        for (const item of items) {
          const dbItem = ret.items.find(i => i.id === item.itemId);
          if (!dbItem) {
            throw new Error(`Item ${item.itemId} does not belong to this Customer Return`);
          }

          // Update item action
          await tx.customerReturnItem.update({
            where: { id: item.itemId },
            data: { action: item.action },
          });

          // Fetch original invoice item cost price snapshot
          const originalInvItem = ret.invoice.items.find(i => i.productId === dbItem.productId);
          const unitCost = originalInvItem ? originalInvItem.costPrice : 0;

          if (item.action === ReturnAction.RETURN_TO_STOCK) {
            const destStock = await tx.warehouseStock.findUnique({
              where: {
                productId_warehouseId: {
                  productId: dbItem.productId,
                  warehouseId: ret.warehouseId,
                },
              },
            });

            const previousStock = destStock ? destStock.quantity : 0;
            const newStock = previousStock + dbItem.quantity;

            // Upsert WarehouseStock
            await tx.warehouseStock.upsert({
              where: {
                productId_warehouseId: {
                  productId: dbItem.productId,
                  warehouseId: ret.warehouseId,
                },
              },
              update: { quantity: newStock },
              create: {
                productId: dbItem.productId,
                warehouseId: ret.warehouseId,
                quantity: newStock,
              },
            });

            // Log InventoryTransaction (Type: RETURN)
            await tx.inventoryTransaction.create({
              data: {
                productId: dbItem.productId,
                warehouseId: ret.warehouseId,
                type: TransactionType.RETURN,
                quantity: dbItem.quantity,
                previousStock,
                newStock,
                reason: `Customer Return ${ret.returnNumber}`,
                correlationId: ret.returnNumber,
                createdByUserId: userId,
              },
            });

            // Create new FIFO layer at original cost price
            await FifoService.createFifoLayer(tx, {
              productId: dbItem.productId,
              warehouseId: ret.warehouseId,
              quantity: dbItem.quantity,
              unitCost,
              batchNumber: `RMA-${ret.returnNumber}`,
            });
          } else if (item.action === ReturnAction.WRITE_OFF) {
            // Log as removal (loss / wastage)
            await tx.inventoryTransaction.create({
              data: {
                productId: dbItem.productId,
                warehouseId: ret.warehouseId,
                type: TransactionType.REMOVAL,
                quantity: -dbItem.quantity,
                previousStock: 0,
                newStock: 0,
                reason: `RMA Write-off - Return ${ret.returnNumber}`,
                correlationId: ret.returnNumber,
                createdByUserId: userId,
              },
            });
          } else if (item.action === ReturnAction.RETURN_TO_SUPPLIER) {
            // Log as removal (Supplier Return)
            await tx.inventoryTransaction.create({
              data: {
                productId: dbItem.productId,
                warehouseId: ret.warehouseId,
                type: TransactionType.REMOVAL,
                quantity: -dbItem.quantity,
                previousStock: 0,
                newStock: 0,
                reason: `RMA Return to Supplier - Return ${ret.returnNumber}`,
                correlationId: ret.returnNumber,
                createdByUserId: userId,
              },
            });
          }
        }

        // 2. Release Refund
        if (ret.refundMethod === RefundMethod.CREDIT_NOTE && ret.customerId) {
          // Update customer ledger
          const customer = await tx.customer.findUnique({ where: { id: ret.customerId } });
          if (customer) {
            await tx.customer.update({
              where: { id: ret.customerId },
              data: {
                outstandingBalance: customer.outstandingBalance - ret.refundAmount,
              },
            });

            await tx.customerLedger.create({
              data: {
                customerId: ret.customerId,
                invoiceId: ret.invoiceId,
                type: LedgerEntryType.PAYMENT,
                amount: ret.refundAmount,
                previousBalance: customer.outstandingBalance,
                newBalance: customer.outstandingBalance - ret.refundAmount,
                correlationId: ret.returnNumber,
                notes: `RMA Refund Credit - Return ${ret.returnNumber}`,
              },
            });
          }
        } else if (ret.refundMethod === RefundMethod.CASH) {
          // Verify and record cash register payout
          const activeSession = await tx.registerSession.findFirst({
            where: {
              cashierId: userId,
              status: RegisterStatus.OPEN,
            },
          });

          if (activeSession) {
            await tx.registerTransaction.create({
              data: {
                sessionId: activeSession.id,
                type: RegTxType.CASH_OUT,
                amount: ret.refundAmount,
                description: `RMA Cash Refund - Return ${ret.returnNumber}`,
              },
            });

            await tx.registerSession.update({
              where: { id: activeSession.id },
              data: {
                expectedCash: activeSession.expectedCash - ret.refundAmount,
              },
            });
          }
        }
      }

      // Update CustomerReturn status
      const updated = await tx.customerReturn.update({
        where: { id },
        data: {
          status,
          processedById: userId,
          remarks: remarks || ret.remarks,
          updatedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'RMA_PROCESS',
          description: `Processed Customer Return ${ret.returnNumber} with status: ${status}`,
          correlationId,
          metadata: {
            returnId: id,
            returnNumber: ret.returnNumber,
            status,
            items,
          },
        },
      });

      return updated;
    });

    logger.info(`Customer Return ${ret.returnNumber} processed by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: processed,
    });
  } catch (error: any) {
    logger.error(`Failed to process Customer Return: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to process customer return', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated Customer Returns
 */
export const getReturns = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const statusParam = req.query.status as string;
    const search = req.query.search as string;

    const validStatuses = Object.values(ReturnStatus);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (statusParam && validStatuses.includes(statusParam as ReturnStatus)) {
      where.status = statusParam as ReturnStatus;
    }

    if (search) {
      where.OR = [
        { returnNumber: { contains: search } },
        { invoice: { invoiceNumber: { contains: search } } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.customerReturn.findMany({
        where,
        include: {
          invoice: { select: { invoiceNumber: true } },
          customer: { select: { name: true, phone: true } },
          warehouse: { select: { name: true } },
          createdBy: { select: { username: true } },
          processedBy: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customerReturn.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: returns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch returns: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch customer returns', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get detailed view of a Customer Return
 */
export const getReturnDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ret = await prisma.customerReturn.findUnique({
      where: { id },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            createdAt: true,
            grandTotal: true,
          },
        },
        customer: true,
        warehouse: true,
        createdBy: { select: { username: true } },
        processedBy: { select: { username: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,

                barcode: true,
              },
            },
          },
        },
      },
    });

    if (!ret) {
      return res.status(404).json({
        success: false,
        error: { message: 'Customer Return not found', code: 'NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      data: ret,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch return details: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch customer return details', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

