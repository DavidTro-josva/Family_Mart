import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

/**
 * Universal Search across Products, Invoices, Customers, Suppliers, POs, and GRNs
 */
export const getUniversalSearch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q ? (req.query.q as string).trim() : '';

    if (query.length < 2) {
      return res.status(200).json({
        success: true,
        data: { products: [], invoices: [], customers: [], suppliers: [], purchaseOrders: [], goodsReceipts: [] },
      });
    }

    // Execute queries in parallel
    const [products, invoices, customers, suppliers, purchaseOrders, goodsReceipts] = await Promise.all([
      // 1. Products (Search by name, SKU, or barcode)
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query } },

            { barcode: { contains: query } },
          ],
        },
        take: 5,
      }),
      // 2. Invoices (Search by invoiceNumber)
      prisma.invoice.findMany({
        where: { invoiceNumber: { contains: query } },
        take: 5,
        include: { customer: true },
      }),
      // 3. Customers (Search by name, email, or phone)
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        take: 5,
      }),
      // 4. Suppliers (Search by name, phone, or email)
      prisma.supplier.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        take: 5,
      }),
      // 5. Purchase Orders (Search by poNumber)
      prisma.purchaseOrder.findMany({
        where: { poNumber: { contains: query } },
        take: 5,
        include: { supplier: true },
      }),
      // 6. Goods Receipts (Search by grnNumber)
      prisma.goodsReceipt.findMany({
        where: { grnNumber: { contains: query } },
        take: 5,
        include: { supplier: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products,
        invoices,
        customers,
        suppliers,
        purchaseOrders,
        goodsReceipts,
      },
    });
  } catch (error: any) {
    logger.error(`Universal Search failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Universal search failed', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Unified Event Explorer Timeline (Combining Audits, Inventory Movements, and PO Events)
 */
export const getEventTimeline = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const category = req.query.category as string || 'ALL'; // ALL, INVENTORY, SECURITY, PROCUREMENT

    const timelineEvents: {
      id: string;
      timestamp: Date;
      type: string;
      title: string;
      description: string;
      user: string;
      meta: any;
    }[] = [];

    // Fetch data based on selected category
    const fetchAudits = category === 'ALL' || category === 'SECURITY' || category === 'FINANCIAL';
    const fetchInventory = category === 'ALL' || category === 'INVENTORY';
    const fetchProcurement = category === 'ALL' || category === 'PROCUREMENT';

    const [audits, inventoryTx, poTimeline] = await Promise.all([
      fetchAudits
        ? prisma.auditLog.findMany({
            take: limit * 2,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { username: true } } },
          })
        : [],
      fetchInventory
        ? prisma.inventoryTransaction.findMany({
            take: limit * 2,
            orderBy: { createdAt: 'desc' },
            include: {
              product: { select: { name: true } },
              warehouse: { select: { name: true } },
              user: { select: { username: true } },
            },
          })
        : [],
      fetchProcurement
        ? prisma.pOTimelineEvent.findMany({
            take: limit * 2,
            orderBy: { createdAt: 'desc' },
            include: {
              purchaseOrder: { select: { poNumber: true } },
              user: { select: { username: true } },
            },
          })
        : [],
    ]);

    // Format Audit Logs
    audits.forEach(log => {
      timelineEvents.push({
        id: log.id,
        timestamp: log.createdAt,
        type: 'SECURITY_AUDIT',
        title: log.eventType,
        description: log.description,
        user: log.user?.username || 'SYSTEM',
        meta: log.metadata,
      });
    });

    // Format Inventory Transactions
    inventoryTx.forEach(tx => {
      timelineEvents.push({
        id: tx.id,
        timestamp: tx.createdAt,
        type: 'INVENTORY_MOVEMENT',
        title: `${tx.type} Stock Adjustment`,
        description: `${tx.quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(tx.quantity)} units of ${tx.product.name} in ${tx.warehouse.name}. Reason: ${tx.reason || 'N/A'}`,
        user: tx.user?.username || 'SYSTEM',
        meta: { previousStock: tx.previousStock, newStock: tx.newStock },
      });
    });

    poTimeline.forEach(event => {
      timelineEvents.push({
        id: event.id,
        timestamp: event.createdAt,
        type: 'PROCUREMENT_EVENT',
        title: `PO #${event.purchaseOrder.poNumber} - ${event.status}`,
        description: event.description || `Purchase Order status transitioned to ${event.status}.`,
        user: event.user?.username || 'SYSTEM',
        meta: null,
      });
    });

    // Sort combined events descending by timestamp
    const sortedEvents = timelineEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      data: sortedEvents,
      page,
      limit,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch Event Timeline: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve event timeline', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

