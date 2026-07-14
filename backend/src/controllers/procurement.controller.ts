import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { POStatus, SupplierStatus } from '@prisma/client';

/**
 * Helper to generate PO Number: PO-YYYYMMDD-XXXX
 */
async function generatePONumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.purchaseOrder.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return `PO-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
}

/**
 * Create a new Purchase Order
 */
export const createPO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { supplierId, warehouseId, expectedDeliveryDate, items } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Verify supplier exists and is active
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || !supplier.isActive || supplier.status === SupplierStatus.BLACKLISTED) {
      return res.status(400).json({
        success: false,
        error: { message: 'Supplier is invalid, inactive, or blacklisted', code: 'INVALID_SUPPLIER' },
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

    // Verify products exist
    const productIds = items.map((item: any) => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (dbProducts.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: { message: 'One or more products are invalid or inactive', code: 'INVALID_PRODUCTS' },
      });
    }

    const poNumber = await generatePONumber();
    const correlationId = req.correlationId || 'PO_CREATE';

    // Calculate item costs and PO total
    let poTotal = 0;
    const poItemsData = items.map((item: any) => {
      const subtotal = item.quantity * item.unitCost;
      const taxAmount = subtotal * (item.taxRate / 100);
      const totalCost = subtotal + taxAmount - item.discountAmount;
      poTotal += totalCost;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        taxAmount,
        discountAmount: item.discountAmount,
        totalCost,
        remarks: item.remarks || null,
      };
    });

    // Execute PO creation inside a transaction
    const newPO = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase Order
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          warehouseId,
          expectedDeliveryDate: new Date(expectedDeliveryDate),
          createdById: userId,
          status: POStatus.PENDING_APPROVAL,
          totalAmount: poTotal,
          items: {
            create: poItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      // 2. Create Timeline Event
      await tx.pOTimelineEvent.create({
        data: {
          purchaseOrderId: po.id,
          status: POStatus.PENDING_APPROVAL,
          description: 'Purchase Order created and submitted for approval',
          createdById: userId,
        },
      });

      // 3. Log Audit Trail
      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'PO_CREATE',
          description: `Created Purchase Order ${poNumber} for supplier ${supplier.name} - Total: $${poTotal.toFixed(2)}`,
          correlationId,
          metadata: {
            poId: po.id,
            poNumber,
            totalAmount: poTotal,
          },
        },
      });

      return po;
    });

    logger.info(`Purchase Order ${poNumber} created successfully by user ${userId}`);

    return res.status(201).json({
      success: true,
      data: newPO,
    });
  } catch (error: any) {
    logger.error(`Failed to create PO: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to create Purchase Order', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Update Purchase Order Status (Approval Workflow)
 */
export const updatePOStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvalComments } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Retrieve existing PO
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        error: { message: 'Purchase Order not found', code: 'NOT_FOUND' },
      });
    }

    // Role-based restrictions: only ADMIN or MANAGER can approve or cancel a PO from pending
    if (status === POStatus.APPROVED && userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        error: { message: 'Only managers or administrators can approve purchase orders', code: 'FORBIDDEN' },
      });
    }

    // Prevent modifying completed or cancelled POs
    if (po.status === POStatus.COMPLETE || po.status === POStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot change status of a ${po.status} purchase order`, code: 'INVALID_STATUS_TRANSITION' },
      });
    }

    const correlationId = req.correlationId || 'PO_STATUS_UPDATE';
    let statusDescription = `PO status updated to ${status}`;
    if (status === POStatus.APPROVED) {
      statusDescription = 'Purchase Order approved by manager';
    } else if (status === POStatus.CANCELLED) {
      statusDescription = 'Purchase Order cancelled';
    } else if (status === POStatus.SENT) {
      statusDescription = 'Purchase Order sent to supplier';
    }

    const updatedPO = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === POStatus.APPROVED) {
        updateData.approvedById = userId;
        updateData.approvalComments = approvalComments || null;
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: updateData,
      });

      await tx.pOTimelineEvent.create({
        data: {
          purchaseOrderId: id,
          status,
          description: approvalComments ? `${statusDescription} - Comments: ${approvalComments}` : statusDescription,
          createdById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'PO_STATUS_CHANGE',
          description: `Updated PO ${po.poNumber} status to ${status}`,
          correlationId,
          metadata: {
            poId: id,
            poNumber: po.poNumber,
            oldStatus: po.status,
            newStatus: status,
            comments: approvalComments || null,
          },
        },
      });

      return updated;
    });

    logger.info(`PO ${po.poNumber} status updated to ${status} by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: updatedPO,
    });
  } catch (error: any) {
    logger.error(`Failed to update PO status: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to update Purchase Order status', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated & Filtered Purchase Orders
 */
export const getPOs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const statusParam = req.query.status as string;
    const supplierId = req.query.supplierId as string;
    const search = req.query.search as string;

    const validStatuses = Object.values(POStatus);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (statusParam && validStatuses.includes(statusParam as POStatus)) {
      where.status = statusParam as POStatus;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (search) {
      where.OR = [
        { poNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          warehouse: { select: { name: true } },
          creator: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: pos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch POs: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch Purchase Orders', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get detailed view of a Purchase Order
 */
export const getPODetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        creator: { select: { id: true, username: true, role: true } },
        approver: { select: { id: true, username: true, role: true } },
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
        timeline: {
          include: {
            user: { select: { username: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        error: { message: 'Purchase Order not found', code: 'NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      data: po,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch PO details: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch Purchase Order details', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Update extended supplier details
 */
export const updateSupplierDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: { message: 'Supplier not found', code: 'NOT_FOUND' },
      });
    }

    const correlationId = req.correlationId || 'SUPPLIER_UPDATE';

    const updatedSupplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          ...req.body,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'SUPPLIER_UPDATE_DETAILS',
          description: `Updated profile details for supplier ${supplier.name}`,
          correlationId,
          metadata: {
            supplierId: id,
            changes: req.body,
          },
        },
      });

      return updated;
    });

    logger.info(`Supplier ${supplier.name} updated by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: updatedSupplier,
    });
  } catch (error: any) {
    logger.error(`Failed to update supplier details: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to update supplier details', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Procurement Dashboard Metrics & Supplier Rankings
 */
export const getProcurementMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();

    // 1. Calculate count metrics
    const [pendingCount, approvedCount, sentCount, totalCount] = await Promise.all([
      prisma.purchaseOrder.count({ where: { status: POStatus.PENDING_APPROVAL } }),
      prisma.purchaseOrder.count({ where: { status: POStatus.APPROVED } }),
      prisma.purchaseOrder.count({ where: { status: POStatus.SENT } }),
      prisma.purchaseOrder.count(),
    ]);

    // 2. Delayed POs (status APPROVED or SENT, expected delivery date in the past, and not completed)
    const delayedCount = await prisma.purchaseOrder.count({
      where: {
        status: { in: [POStatus.APPROVED, POStatus.SENT] },
        expectedDeliveryDate: { lt: now },
      },
    });

    // 3. Today's Purchases (sum of PO amounts approved or completed today)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayPurchasesObj = await prisma.purchaseOrder.aggregate({
      where: {
        status: { in: [POStatus.APPROVED, POStatus.SENT, POStatus.COMPLETE] },
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      _sum: { totalAmount: true },
    });

    // 4. Supplier performance ranking (top 5 suppliers by performanceRating)
    const topSuppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        performanceRating: true,
        status: true,
      },
      orderBy: { performanceRating: 'desc' },
      take: 5,
    });

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          pendingPOs: pendingCount,
          approvedPOs: approvedCount,
          sentPOs: sentCount,
          delayedPOs: delayedCount,
          totalPOs: totalCount,
          todayPurchases: todayPurchasesObj._sum.totalAmount || 0,
        },
        topSuppliers,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch procurement metrics: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch procurement metrics', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

