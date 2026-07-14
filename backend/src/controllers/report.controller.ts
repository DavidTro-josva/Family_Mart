import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

/**
 * Get Sales & Revenue Analytics Report
 */
export const getSalesReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch invoices in date range
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'PAID',
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                subCategory: {
                  include: { category: true },
                },
              },
            },
          },
        },
      },
    });

    // Aggregations
    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    const totalTransactions = invoices.length;
    const paymentMethods: { [key: string]: number } = { CASH: 0, UPI: 0, CARD: 0, SPLIT: 0 };
    
    // Product and Category Sales ranking
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    const categorySales: { [key: string]: number } = {};

    invoices.forEach(inv => {
      totalRevenue += inv.grandTotal;
      totalTax += inv.taxAmount;
      totalDiscount += inv.discount;

      if (paymentMethods[inv.paymentMethod] !== undefined) {
        paymentMethods[inv.paymentMethod] += inv.grandTotal;
      }

      inv.items.forEach(item => {
        // Product ranking
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.total;

        // Category sales
        const catName = item.product.subCategory.category.name;
        categorySales[catName] = (categorySales[catName] || 0) + item.total;
      });
    });

    const sortedProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalTax,
          totalDiscount,
          totalTransactions,
          averageOrderValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        },
        paymentMethods,
        topProducts: sortedProducts,
        categorySales,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate sales report: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate sales report', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Inventory Valuation & Stock Movement Report
 */
export const getInventoryReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Calculate active stock value using FIFO layers
    const activeLayers = await prisma.fifoLayer.findMany({
      where: { remainingQuantity: { gt: 0 } },
      include: { product: true, warehouse: true },
    });

    let totalFifoValue = 0;
    const warehouseValuation: { [key: string]: { name: string; value: number; count: number } } = {};

    activeLayers.forEach(layer => {
      const value = layer.remainingQuantity * layer.unitCost;
      totalFifoValue += value;

      if (!warehouseValuation[layer.warehouseId]) {
        warehouseValuation[layer.warehouseId] = {
          name: layer.warehouse.name,
          value: 0,
          count: 0,
        };
      }
      warehouseValuation[layer.warehouseId].value += value;
      warehouseValuation[layer.warehouseId].count += layer.remainingQuantity;
    });

    // 2. Fetch low stock items
    const stocks = await prisma.warehouseStock.findMany({
      include: {
        product: true,
        warehouse: true,
      },
    });

    const lowStockItems = stocks
      .filter(s => s.quantity <= s.reorderLevel)
      .map(s => ({
        productId: s.productId,
        productName: s.product.name,
        warehouseName: s.warehouse.name,
        quantity: s.quantity,
        reorderLevel: s.reorderLevel,
      }));

    // 3. Fetch recent stock movement transactions
    const recentMovements = await prisma.inventoryTransaction.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true } },
        warehouse: { select: { name: true } },
        user: { select: { username: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        valuation: {
          totalFifoValue,
          warehouses: Object.values(warehouseValuation),
        },
        lowStockCount: lowStockItems.length,
        lowStockItems,
        recentMovements,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate inventory report: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate inventory report', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get GST Tax Report (GST Collected vs GST Paid)
 */
export const getTaxReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // 1. GST Collected on Sales (Output Tax)
    const sales = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'PAID',
      },
      include: { items: true },
    });

    const outputTaxSummary: { [key: number]: { taxableAmount: number; gstAmount: number } } = {};

    sales.forEach(inv => {
      inv.items.forEach(item => {
        const rate = item.gstRate;
        if (!outputTaxSummary[rate]) {
          outputTaxSummary[rate] = { taxableAmount: 0, gstAmount: 0 };
        }
        // total = taxable + gst
        const taxable = item.total - item.gstAmount;
        outputTaxSummary[rate].taxableAmount += taxable;
        outputTaxSummary[rate].gstAmount += item.gstAmount;
      });
    });

    // 2. GST Paid on Purchases (Input Tax Credit - ITC)
    const purchases = await prisma.supplierInvoice.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'POSTED',
      },
      include: { items: true },
    });

    const inputTaxSummary: { [key: number]: { taxableAmount: number; gstAmount: number } } = {};

    purchases.forEach(inv => {
      inv.items.forEach(item => {
        // Estimate GST rate since it's purchase
        const rate = 18; // Default 18% GST for simplicity
        if (!inputTaxSummary[rate]) {
          inputTaxSummary[rate] = { taxableAmount: 0, gstAmount: 0 };
        }
        inputTaxSummary[rate].taxableAmount += item.total - item.taxAmount;
        inputTaxSummary[rate].gstAmount += item.taxAmount;
      });
    });

    // Format output
    const outputTax = Object.entries(outputTaxSummary).map(([rate, data]) => ({
      rate: parseFloat(rate),
      taxableAmount: data.taxableAmount,
      gstAmount: data.gstAmount,
    }));

    const inputTax = Object.entries(inputTaxSummary).map(([rate, data]) => ({
      rate: parseFloat(rate),
      taxableAmount: data.taxableAmount,
      gstAmount: data.gstAmount,
    }));

    const totalOutputGst = outputTax.reduce((acc, t) => acc + t.gstAmount, 0);
    const totalInputGst = inputTax.reduce((acc, t) => acc + t.gstAmount, 0);

    return res.status(200).json({
      success: true,
      data: {
        outputTax,
        inputTax,
        netTaxPayable: totalOutputGst - totalInputGst,
        totalOutputGst,
        totalInputGst,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate tax report: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate tax report', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Financial Ledger & Cash Flow Report
 */
export const getFinancialReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // 1. Fetch total receivables (outstanding customer credit)
    const customers = await prisma.customer.findMany({
      where: { outstandingBalance: { gt: 0 } },
      select: { outstandingBalance: true },
    });
    const totalReceivables = customers.reduce((acc, c) => acc + c.outstandingBalance, 0);

    // 2. Fetch total payables (outstanding supplier payables)
    const suppliers = await prisma.supplier.findMany({
      where: { outstandingBalance: { gt: 0 } },
      select: { outstandingBalance: true },
    });
    const totalPayables = suppliers.reduce((acc, s) => acc + s.outstandingBalance, 0);

    // 3. Cash Flow Timeline (from Register Transactions)
    const regTx = await prisma.registerTransaction.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        session: { select: { cashier: { select: { username: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalCashIn = 0;
    let totalCashOut = 0;

    const formattedTransactions = regTx.map(tx => {
      const isCashIn = tx.type === 'CASH_IN';
      if (isCashIn) {
        totalCashIn += tx.amount;
      } else {
        totalCashOut += tx.amount;
      }

      return {
        id: tx.id,
        date: tx.createdAt,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        cashier: tx.session.cashier.username,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        ledgerSummary: {
          totalReceivables,
          totalPayables,
          netOutstanding: totalReceivables - totalPayables,
        },
        cashFlow: {
          totalCashIn,
          totalCashOut,
          netCashFlow: totalCashIn - totalCashOut,
          transactions: formattedTransactions,
        },
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate financial report: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate financial report', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

