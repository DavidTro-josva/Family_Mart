import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { TransferStatus, TransferItemStatus, TransactionType } from '@prisma/client';
import { FifoService } from '../services/fifo.service.js';

/**
 * Helper to generate Transfer Number: TR-YYYYMMDD-XXXX
 */
async function generateTransferNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.stockTransfer.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return `TR-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
}

/**
 * Create a new Stock Transfer Request (STR)
 */
export const createTransfer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceWarehouseId, destinationWarehouseId, remarks, items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Verify warehouses exist
    const source = await prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } });
    if (!source || !source.isActive) {
      return res.status(400).json({
        success: false,
        error: { message: 'Source warehouse is invalid or inactive', code: 'INVALID_SOURCE' },
      });
    }

    const dest = await prisma.warehouse.findUnique({ where: { id: destinationWarehouseId } });
    if (!dest || !dest.isActive) {
      return res.status(400).json({
        success: false,
        error: { message: 'Destination warehouse is invalid or inactive', code: 'INVALID_DESTINATION' },
      });
    }

    const transferNumber = await generateTransferNumber();
    const correlationId = req.correlationId || 'TRANSFER_CREATE';

    const newTransfer = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          sourceWarehouseId,
          destinationWarehouseId,
          status: TransferStatus.PENDING_APPROVAL,
          createdById: userId,
          remarks: remarks || null,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantityRequested: item.quantityRequested,
              status: TransferItemStatus.PENDING,
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
          eventType: 'TRANSFER_CREATE',
          description: `Requested Stock Transfer ${transferNumber} from ${source.name} to ${dest.name}`,
          correlationId,
          metadata: {
            transferId: transfer.id,
            transferNumber,
          },
        },
      });

      return transfer;
    });

    logger.info(`Stock Transfer ${transferNumber} requested by user ${userId}`);

    return res.status(201).json({
      success: true,
      data: newTransfer,
    });
  } catch (error: any) {
    logger.error(`Failed to create Stock Transfer: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to request stock transfer', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Approve Stock Transfer Request
 */
export const approveTransfer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: { message: 'Stock Transfer not found', code: 'NOT_FOUND' },
      });
    }

    if (transfer.status !== TransferStatus.PENDING_APPROVAL) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot approve transfer in ${transfer.status} status`, code: 'INVALID_STATUS' },
      });
    }

    const correlationId = req.correlationId || 'TRANSFER_APPROVE';

    const approvedTransfer = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.APPROVED,
          approvedById: userId,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'TRANSFER_APPROVE',
          description: `Approved Stock Transfer ${transfer.transferNumber}`,
          correlationId,
          metadata: {
            transferId: id,
            transferNumber: transfer.transferNumber,
          },
        },
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      data: approvedTransfer,
    });
  } catch (error: any) {
    logger.error(`Failed to approve Stock Transfer: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to approve stock transfer', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Dispatch Stock Transfer (Goods Issue Note - GIN)
 */
export const dispatchTransfer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: { message: 'Stock Transfer not found', code: 'NOT_FOUND' },
      });
    }

    if (transfer.status !== TransferStatus.APPROVED && transfer.status !== TransferStatus.PENDING_APPROVAL) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot dispatch transfer in ${transfer.status} status`, code: 'INVALID_STATUS' },
      });
    }

    const correlationId = req.correlationId || 'TRANSFER_DISPATCH';

    const dispatchedTransfer = await prisma.$transaction(async (tx) => {
      // 1. Process each item: validate source stock, deduct stock, and consume FIFO layers
      for (const item of items) {
        const dbItem = transfer.items.find(i => i.id === item.itemId);
        if (!dbItem) {
          throw new Error(`Item ${item.itemId} does not belong to this Stock Transfer`);
        }

        const qtyToDispatch = item.quantityDispatched;
        if (qtyToDispatch <= 0) continue;

        // Check source stock
        const sourceStock = await tx.warehouseStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: dbItem.productId,
              warehouseId: transfer.sourceWarehouseId,
            },
          },
        });

        if (!sourceStock || sourceStock.quantity < qtyToDispatch) {
          throw new Error(`INSUFFICIENT_STOCK:${dbItem.productId}`);
        }

        const previousStock = sourceStock.quantity;
        const newStock = previousStock - qtyToDispatch;

        // Deduct from source warehouse stock
        await tx.warehouseStock.update({
          where: { id: sourceStock.id },
          data: { quantity: newStock },
        });

        // Log InventoryTransaction (Type: REMOVAL)
        const invTx = await tx.inventoryTransaction.create({
          data: {
            productId: dbItem.productId,
            warehouseId: transfer.sourceWarehouseId,
            type: TransactionType.REMOVAL,
            quantity: -qtyToDispatch,
            previousStock,
            newStock,
            reason: `Dispatched Transfer ${transfer.transferNumber}`,
            correlationId: transfer.transferNumber,
            createdByUserId: userId,
          },
        });

        // Consume FIFO layers from source warehouse
        const totalCost = await FifoService.consumeFifoStock(tx, {
          productId: dbItem.productId,
          warehouseId: transfer.sourceWarehouseId,
          quantity: qtyToDispatch,
          inventoryTransactionId: invTx.id,
        });

        const averageDispatchedCost = totalCost / qtyToDispatch;

        // Update StockTransferItem with dispatch metrics
        await tx.stockTransferItem.update({
          where: { id: item.itemId },
          data: {
            quantityDispatched: qtyToDispatch,
            status: TransferItemStatus.DISPATCHED,
            remarks: JSON.stringify({ averageDispatchedCost }), // Store cost to carry over during receipt
          },
        });
      }

      // 2. Update StockTransfer status to DISPATCHED
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.DISPATCHED,
          dispatchedById: userId,
          updatedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'TRANSFER_DISPATCH',
          description: `Dispatched Stock Transfer ${transfer.transferNumber}`,
          correlationId,
          metadata: {
            transferId: id,
            transferNumber: transfer.transferNumber,
            dispatchedItems: items,
          },
        },
      });

      return updated;
    });

    logger.info(`Stock Transfer ${transfer.transferNumber} dispatched by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: dispatchedTransfer,
    });
  } catch (error: any) {
    logger.error(`Failed to dispatch Stock Transfer: ${error.message}`);
    if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
      return res.status(400).json({
        success: false,
        error: { message: 'Insufficient stock in source warehouse to dispatch transfer', code: 'INSUFFICIENT_STOCK' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to dispatch stock transfer', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Receive Stock Transfer & Log Variances (Goods Receipt Note - GRN)
 */
export const receiveTransfer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: { message: 'Stock Transfer not found', code: 'NOT_FOUND' },
      });
    }

    if (transfer.status !== TransferStatus.DISPATCHED) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot receive transfer in ${transfer.status} status`, code: 'INVALID_STATUS' },
      });
    }

    const correlationId = req.correlationId || 'TRANSFER_RECEIVE';

    const receivedTransfer = await prisma.$transaction(async (tx) => {
      // 1. Process each item: update destination stock, create destination FIFO layers, and log variances
      for (const item of items) {
        const dbItem = transfer.items.find(i => i.id === item.itemId);
        if (!dbItem) {
          throw new Error(`Item ${item.itemId} does not belong to this Stock Transfer`);
        }

        const qtyReceived = item.quantityReceived;
        const qtyDamaged = item.quantityDamaged || 0;
        const qtyLost = item.quantityLost || 0;

        // Parse cost details stored during dispatch
        let averageUnitCost = 0;
        if (dbItem.remarks) {
          try {
            const costData = JSON.parse(dbItem.remarks);
            averageUnitCost = costData.averageDispatchedCost || 0;
          } catch (e) {
            averageUnitCost = 0;
          }
        }

        // If we received some stock, add it to destination warehouse
        if (qtyReceived > 0) {
          const destStock = await tx.warehouseStock.findUnique({
            where: {
              productId_warehouseId: {
                productId: dbItem.productId,
                warehouseId: transfer.destinationWarehouseId,
              },
            },
          });

          const previousStock = destStock ? destStock.quantity : 0;
          const newStock = previousStock + qtyReceived;

          // Upsert WarehouseStock
          await tx.warehouseStock.upsert({
            where: {
              productId_warehouseId: {
                productId: dbItem.productId,
                warehouseId: transfer.destinationWarehouseId,
              },
            },
            update: { quantity: newStock },
            create: {
              productId: dbItem.productId,
              warehouseId: transfer.destinationWarehouseId,
              quantity: newStock,
            },
          });

          // Log InventoryTransaction (Type: ADDITION)
          await tx.inventoryTransaction.create({
            data: {
              productId: dbItem.productId,
              warehouseId: transfer.destinationWarehouseId,
              type: TransactionType.ADDITION,
              quantity: qtyReceived,
              previousStock,
              newStock,
              reason: `Received Transfer ${transfer.transferNumber}`,
              correlationId: transfer.transferNumber,
              createdByUserId: userId,
            },
          });

          // Create new FIFO layer in destination warehouse preserving original cost
          await FifoService.createFifoLayer(tx, {
            productId: dbItem.productId,
            warehouseId: transfer.destinationWarehouseId,
            quantity: qtyReceived,
            unitCost: averageUnitCost,
            batchNumber: `TR-BATCH-${transfer.transferNumber}`,
          });
        }

        // Log Damaged / Lost stock as removals
        if (qtyDamaged > 0) {
          await tx.inventoryTransaction.create({
            data: {
              productId: dbItem.productId,
              warehouseId: transfer.destinationWarehouseId,
              type: TransactionType.REMOVAL,
              quantity: -qtyDamaged,
              previousStock: 0, // Transit write-off
              newStock: 0,
              reason: `Damaged in Transit - Transfer ${transfer.transferNumber}`,
              correlationId: transfer.transferNumber,
              createdByUserId: userId,
            },
          });
        }

        if (qtyLost > 0) {
          await tx.inventoryTransaction.create({
            data: {
              productId: dbItem.productId,
              warehouseId: transfer.destinationWarehouseId,
              type: TransactionType.REMOVAL,
              quantity: -qtyLost,
              previousStock: 0, // Transit write-off
              newStock: 0,
              reason: `Lost in Transit - Transfer ${transfer.transferNumber}`,
              correlationId: transfer.transferNumber,
              createdByUserId: userId,
            },
          });
        }

        // Update StockTransferItem status to RECEIVED
        await tx.stockTransferItem.update({
          where: { id: item.itemId },
          data: {
            quantityReceived: qtyReceived,
            quantityDamaged: qtyDamaged,
            quantityLost: qtyLost,
            status: TransferItemStatus.RECEIVED,
            remarks: item.remarks || null,
          },
        });
      }

      // 2. Update StockTransfer status to RECEIVED
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.RECEIVED,
          receivedById: userId,
          updatedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'TRANSFER_RECEIVE',
          description: `Received and reconciled Stock Transfer ${transfer.transferNumber}`,
          correlationId,
          metadata: {
            transferId: id,
            transferNumber: transfer.transferNumber,
            receivedItems: items,
          },
        },
      });

      return updated;
    });

    logger.info(`Stock Transfer ${transfer.transferNumber} received by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: receivedTransfer,
    });
  } catch (error: any) {
    logger.error(`Failed to receive Stock Transfer: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to receive stock transfer', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated Stock Transfers
 */
export const getTransfers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const statusParam = req.query.status as string;
    const search = req.query.search as string;

    const validStatuses = Object.values(TransferStatus);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (statusParam && validStatuses.includes(statusParam as TransferStatus)) {
      where.status = statusParam as TransferStatus;
    }

    if (search) {
      where.OR = [
        { transferNumber: { contains: search } },
      ];
    }

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          sourceWarehouse: { select: { name: true, code: true } },
          destinationWarehouse: { select: { name: true, code: true } },
          createdBy: { select: { username: true } },
          approvedBy: { select: { username: true } },
          dispatchedBy: { select: { username: true } },
          receivedBy: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: transfers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch transfers: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch stock transfers', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get detailed view of a Stock Transfer
 */
export const getTransferDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: true,
        destinationWarehouse: true,
        createdBy: { select: { username: true } },
        approvedBy: { select: { username: true } },
        dispatchedBy: { select: { username: true } },
        receivedBy: { select: { username: true } },
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

    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: { message: 'Stock Transfer not found', code: 'NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      data: transfer,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch transfer details: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch stock transfer details', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

