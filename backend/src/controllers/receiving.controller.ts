import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { GRNStatus, ReceiptItemStatus, POStatus, TransactionType } from '@prisma/client';
import { FifoService } from '../services/fifo.service.js';

/**
 * Helper to generate GRN Number: GRN-YYYYMMDD-XXXX
 */
async function generateGRNNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.goodsReceipt.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return `GRN-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
}

/**
 * Create a new Goods Receipt Note (GRN)
 */
export const createGRN = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { purchaseOrderId, supplierId, warehouseId, remarks, items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || !supplier.isActive) {
      return res.status(400).json({
        success: false,
        error: { message: 'Supplier is invalid or inactive', code: 'INVALID_SUPPLIER' },
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

    // Verify PO if provided
    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
      if (!po || po.status === POStatus.COMPLETE || po.status === POStatus.CANCELLED) {
        return res.status(400).json({
          success: false,
          error: { message: 'Purchase Order is invalid, completed, or cancelled', code: 'INVALID_PO' },
        });
      }
    }

    const grnNumber = await generateGRNNumber();
    const correlationId = req.correlationId || 'GRN_CREATE';

    // Create GRN inside transaction
    const newGRN = await prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseOrderId: purchaseOrderId || null,
          supplierId,
          warehouseId,
          status: GRNStatus.DRAFT,
          receivedById: userId,
          remarks: remarks || null,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantityOrdered: item.quantityOrdered || 0,
              quantityReceived: item.quantityReceived,
              quantityAccepted: 0,
              quantityRejected: 0,
              status: ReceiptItemStatus.PASSED, // Default to PASSED before inspection
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
          eventType: 'GRN_CREATE',
          description: `Created Goods Receipt ${grnNumber} for supplier ${supplier.name}`,
          correlationId,
          metadata: {
            grnId: grn.id,
            grnNumber,
            purchaseOrderId,
          },
        },
      });

      return grn;
    });

    logger.info(`Goods Receipt ${grnNumber} created successfully by user ${userId}`);

    return res.status(201).json({
      success: true,
      data: newGRN,
    });
  } catch (error: any) {
    logger.error(`Failed to create GRN: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to create Goods Receipt Note', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated & Filtered Goods Receipts
 */
export const getGRNs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const statusParam = req.query.status as string;
    const supplierId = req.query.supplierId as string;
    const search = req.query.search as string;

    const validStatuses = Object.values(GRNStatus);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (statusParam && validStatuses.includes(statusParam as GRNStatus)) {
      where.status = statusParam as GRNStatus;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (search) {
      where.OR = [
        { grnNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    const [grns, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          warehouse: { select: { name: true } },
          receivedBy: { select: { username: true } },
          inspectedBy: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: grns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch GRNs: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch Goods Receipts', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get detailed view of a Goods Receipt
 */
export const getGRNDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        receivedBy: { select: { username: true } },
        inspectedBy: { select: { username: true } },
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            status: true,
          },
        },
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

    if (!grn) {
      return res.status(404).json({
        success: false,
        error: { message: 'Goods Receipt not found', code: 'NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      data: grn,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch GRN details: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch Goods Receipt details', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Log Inspected Quantities and Statuses
 */
export const inspectGRN = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { remarks, items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!grn) {
      return res.status(404).json({
        success: false,
        error: { message: 'Goods Receipt not found', code: 'NOT_FOUND' },
      });
    }

    if (grn.status === GRNStatus.COMPLETED || grn.status === GRNStatus.REJECTED) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot inspect a ${grn.status} goods receipt`, code: 'INVALID_STATUS' },
      });
    }

    const correlationId = req.correlationId || 'GRN_INSPECT';

    // Perform inspection in transaction
    const inspectedGRN = await prisma.$transaction(async (tx) => {
      // 1. Update each item
      for (const item of items) {
        // Verify item belongs to this GRN
        const dbItem = grn.items.find(i => i.id === item.itemId);
        if (!dbItem) {
          throw new Error(`Item ${item.itemId} does not belong to this Goods Receipt`);
        }

        await tx.goodsReceiptItem.update({
          where: { id: item.itemId },
          data: {
            quantityAccepted: item.quantityAccepted,
            quantityRejected: item.quantityRejected,
            status: item.status,
            binCode: item.binCode || null,
            remarks: item.remarks || null,
          },
        });
      }

      // 2. Update GRN status to PENDING_INSPECTION (or keep as is)
      const updated = await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: GRNStatus.PENDING_INSPECTION,
          inspectedById: userId,
          remarks: remarks || grn.remarks,
          updatedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'GRN_INSPECT',
          description: `Logged inspection results for Goods Receipt ${grn.grnNumber}`,
          correlationId,
          metadata: {
            grnId: id,
            grnNumber: grn.grnNumber,
            inspectedItems: items,
          },
        },
      });

      return updated;
    });

    logger.info(`Goods Receipt ${grn.grnNumber} inspected by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: inspectedGRN,
    });
  } catch (error: any) {
    logger.error(`Failed to inspect GRN: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to inspect Goods Receipt', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Complete Goods Receipt (Atomic Transaction to update stock and PO received quantities)
 */
export const completeGRN = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!grn) {
      return res.status(404).json({
        success: false,
        error: { message: 'Goods Receipt not found', code: 'NOT_FOUND' },
      });
    }

    if (grn.status !== GRNStatus.PENDING_INSPECTION) {
      return res.status(400).json({
        success: false,
        error: { message: 'Goods Receipt must be inspected before completion', code: 'NOT_INSPECTED' },
      });
    }

    const correlationId = req.correlationId || 'GRN_COMPLETE';

    const completedGRN = await prisma.$transaction(async (tx) => {
      // 1. Process each item: update WarehouseStock and log InventoryTransaction
      for (const item of grn.items) {
        if (item.quantityAccepted > 0 && item.status === ReceiptItemStatus.PASSED) {
          // Find existing stock in the designated warehouse
          const existingStock = await tx.warehouseStock.findUnique({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: grn.warehouseId,
              },
            },
          });

          const previousStock = existingStock ? existingStock.quantity : 0;
          const newStock = previousStock + item.quantityAccepted;

          // Upsert WarehouseStock
          await tx.warehouseStock.upsert({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: grn.warehouseId,
              },
            },
            update: {
              quantity: newStock,
              binCode: item.binCode || (existingStock ? existingStock.binCode : null),
            },
            create: {
              productId: item.productId,
              warehouseId: grn.warehouseId,
              quantity: newStock,
              binCode: item.binCode || null,
            },
          });

          // Log InventoryTransaction (Type: PURCHASE / ADDITION)
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              warehouseId: grn.warehouseId,
              type: TransactionType.PURCHASE,
              quantity: item.quantityAccepted,
              previousStock,
              newStock,
              reason: `Goods Receipt ${grn.grnNumber} completed`,
              correlationId: grn.grnNumber,
              createdByUserId: userId,
            },
          });

          // Determine unitCost for FIFO layer
          let unitCost = item.product.costPrice; // Default to product catalog costPrice
          if (grn.purchaseOrderId) {
            const poItem = await tx.purchaseOrderItem.findFirst({
              where: {
                purchaseOrderId: grn.purchaseOrderId,
                productId: item.productId,
              },
            });
            if (poItem) {
              unitCost = poItem.unitCost;
            }
          }

          // Create FIFO Cost Layer
          await FifoService.createFifoLayer(tx, {
            productId: item.productId,
            warehouseId: grn.warehouseId,
            quantity: item.quantityAccepted,
            unitCost,
            grnItemId: item.id,
            batchNumber: item.remarks ? `BATCH-${grn.grnNumber}` : null,
            lotNumber: item.binCode ? `LOT-${item.binCode}` : null,
          });
        }

        // 2. If linked to a PO, update the received quantities on the PO items
        if (grn.purchaseOrderId) {
          // Find matching PO Item
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: {
              purchaseOrderId: grn.purchaseOrderId,
              productId: item.productId,
            },
          });

          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                receivedQuantity: poItem.receivedQuantity + item.quantityReceived,
              },
            });
          }
        }
      }

      // 3. Update GRN status to COMPLETED
      const updated = await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: GRNStatus.COMPLETED,
          updatedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      // 4. Update PO status if linked
      if (grn.purchaseOrderId) {
        const allPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: grn.purchaseOrderId },
        });

        const isFullyReceived = allPOItems.every(item => item.receivedQuantity >= item.quantity);
        const hasReceivedSome = allPOItems.some(item => item.receivedQuantity > 0);

        let newPOStatus: POStatus = POStatus.APPROVED;
        if (isFullyReceived) {
          newPOStatus = POStatus.COMPLETE;
        } else if (hasReceivedSome) {
          newPOStatus = POStatus.PARTIAL;
        }

        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: {
            status: newPOStatus,
            updatedAt: new Date(),
          },
        });

        // Log PO status change timeline event
        await tx.pOTimelineEvent.create({
          data: {
            purchaseOrderId: grn.purchaseOrderId,
            status: newPOStatus,
            description: `PO status updated to ${newPOStatus} via Goods Receipt ${grn.grnNumber}`,
            createdById: userId,
          },
        });
      }

      // 5. Log Audit Trail
      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'GRN_COMPLETE',
          description: `Completed Goods Receipt ${grn.grnNumber} - Stock updated.`,
          correlationId,
          metadata: {
            grnId: id,
            grnNumber: grn.grnNumber,
            purchaseOrderId: grn.purchaseOrderId,
          },
        },
      });

      return updated;
    });

    logger.info(`Goods Receipt ${grn.grnNumber} completed and stock synchronized by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: completedGRN,
    });
  } catch (error: any) {
    logger.error(`Failed to complete GRN: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to complete Goods Receipt', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

