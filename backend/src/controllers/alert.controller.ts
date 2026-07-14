import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

/**
 * Scan database and generate active alerts, then retrieve all unread alerts
 */
export const getAlerts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(new Date().setDate(now.getDate() + 30));

    // 1. Fetch current unread alerts from DB to prevent duplicate inserts
    const existingAlerts = await prisma.alert.findMany({
      where: { isRead: false },
    });
    const existingMessages = new Set(existingAlerts.map(a => a.message));

    const newAlertsData: { title: string; message: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; category: string }[] = [];

    // 2. Scan: Low Stock
    const lowStock = await prisma.warehouseStock.findMany({
      where: { quantity: { lte: prisma.warehouseStock.fields.reorderLevel } },
      include: { product: true, warehouse: true },
    });

    lowStock.forEach(item => {
      const msg = `Product ${item.product.name} is low in ${item.warehouse.name}: ${item.quantity} remaining (Reorder Level: ${item.reorderLevel}).`;
      if (!existingMessages.has(msg)) {
        newAlertsData.push({
          title: 'Low Stock Alert',
          message: msg,
          severity: 'WARNING',
          category: 'STOCK',
        });
      }
    });

    // 3. Scan: Expired and Expiring Stock
    const activeLayers = await prisma.fifoLayer.findMany({
      where: { remainingQuantity: { gt: 0 } },
      include: { product: true },
    });

    activeLayers.forEach(layer => {
      if (layer.expiryDate) {
        const msgExpired = `FIFO Layer for ${layer.product.name} has EXPIRED on ${layer.expiryDate.toLocaleDateString()}. Quantity: ${layer.remainingQuantity}.`;
        const msgExpiring = `FIFO Layer for ${layer.product.name} is expiring soon on ${layer.expiryDate.toLocaleDateString()}. Quantity: ${layer.remainingQuantity}.`;

        if (layer.expiryDate <= now) {
          if (!existingMessages.has(msgExpired)) {
            newAlertsData.push({
              title: 'Expired Stock Critical',
              message: msgExpired,
              severity: 'CRITICAL',
              category: 'STOCK',
            });
          }
        } else if (layer.expiryDate <= thirtyDaysFromNow) {
          if (!existingMessages.has(msgExpiring)) {
            newAlertsData.push({
              title: 'Expiring Stock Warning',
              message: msgExpiring,
              severity: 'WARNING',
              category: 'STOCK',
            });
          }
        }
      }
    });

    // 4. Scan: Customer Credit Limit Breach
    const breachedCustomers = await prisma.customer.findMany({
      where: {
        outstandingBalance: { gt: prisma.customer.fields.creditLimit },
      },
    });

    breachedCustomers.forEach(cust => {
      const msg = `Customer ${cust.name} has breached credit limit: Balance $${cust.outstandingBalance.toFixed(2)} (Limit: $${cust.creditLimit.toFixed(2)}).`;
      if (!existingMessages.has(msg)) {
        newAlertsData.push({
          title: 'Credit Limit Breach',
          message: msg,
          severity: 'CRITICAL',
          category: 'FINANCIAL',
        });
      }
    });

    // 5. Scan: Cash Register Close-Shift Variances
    const recentClosedSessions = await prisma.registerSession.findMany({
      where: { status: 'CLOSED', closedAt: { gte: new Date(new Date().setDate(now.getDate() - 7)) } },
      include: { cashier: true },
    });

    recentClosedSessions.forEach(session => {
      if (session.variance !== 0) {
        const msg = `Register Session #${session.id} closed by ${session.cashier.username} with a variance of $${session.variance.toFixed(2)}.`;
        if (!existingMessages.has(msg)) {
          newAlertsData.push({
            title: 'Cash Drawer Discrepancy',
            message: msg,
            severity: 'CRITICAL',
            category: 'FINANCIAL',
          });
        }
      }
    });

    // 6. Scan: Unusual Invoice Discounts (Discount >= 20% of subtotal)
    const recentInvoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: new Date(new Date().setDate(now.getDate() - 7)) }, status: 'PAID' },
    });

    recentInvoices.forEach(inv => {
      if (inv.discount >= inv.subTotal * 0.2 && inv.discount > 0) {
        const msg = `Invoice #${inv.invoiceNumber} was checked out with an unusual discount of $${inv.discount.toFixed(2)} (Subtotal: $${inv.subTotal.toFixed(2)}).`;
        if (!existingMessages.has(msg)) {
          newAlertsData.push({
            title: 'Unusual Invoice Discount',
            message: msg,
            severity: 'WARNING',
            category: 'DISCOUNT',
          });
        }
      }
    });

    // 7. Bulk insert new alerts into DB
    if (newAlertsData.length > 0) {
      await prisma.alert.createMany({
        data: newAlertsData,
      });
    }

    // 8. Fetch and return all unread alerts
    const allUnreadAlerts = await prisma.alert.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: allUnreadAlerts,
    });
  } catch (error: any) {
    logger.error(`Failed to scan and fetch alerts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve system alerts', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Dismiss / Mark alert as read
 */
export const dismissAlert = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { alertId } = req.params;

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error(`Failed to dismiss alert: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to dismiss alert', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

