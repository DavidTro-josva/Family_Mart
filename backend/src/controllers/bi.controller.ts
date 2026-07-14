import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

/**
 * Get Executive KPIs with Period-over-Period Trend Comparisons
 */
export const getExecutiveKPIs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    
    // Today Range
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Yesterday Range
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);

    // Month-to-Date (MTD) Range
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Last Month-to-Date (LMTD) Range (up to same day of last month)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonthMTD = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours(), now.getMinutes());

    // 1. Fetch Sales (Revenue, COGS, Tax)
    const [todaySales, yesterdaySales, mtdSales, lmtdSales] = await Promise.all([
      prisma.invoice.findMany({
        where: { createdAt: { gte: startOfToday, lte: endOfToday }, status: 'PAID' },
        include: { items: true },
      }),
      prisma.invoice.findMany({
        where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday }, status: 'PAID' },
        include: { items: true },
      }),
      prisma.invoice.findMany({
        where: { createdAt: { gte: startOfThisMonth, lte: endOfToday }, status: 'PAID' },
        include: { items: true },
      }),
      prisma.invoice.findMany({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonthMTD }, status: 'PAID' },
        include: { items: true },
      }),
    ]);

    // Helpers to aggregate sales metrics
    const getMetrics = (invoices: any[]) => {
      let revenue = 0;
      let cogs = 0;
      let tax = 0;
      invoices.forEach(inv => {
        revenue += inv.grandTotal;
        tax += inv.taxAmount;
        inv.items.forEach((item: any) => {
          cogs += item.quantity * item.costPrice;
        });
      });
      const grossProfit = revenue - cogs;
      return {
        revenue,
        cogs,
        tax,
        grossProfit,
        margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        count: invoices.length,
      };
    };

    const todayMetrics = getMetrics(todaySales);
    const yesterdayMetrics = getMetrics(yesterdaySales);
    const mtdMetrics = getMetrics(mtdSales);
    const lmtdMetrics = getMetrics(lmtdSales);

    // 2. Fetch Working Capital (Receivables, Payables, Inventory Cost)
    const [customers, suppliers, fifoLayers] = await Promise.all([
      prisma.customer.findMany({ select: { outstandingBalance: true } }),
      prisma.supplier.findMany({ select: { outstandingBalance: true } }),
      prisma.fifoLayer.findMany({
        where: { remainingQuantity: { gt: 0 } },
        select: { remainingQuantity: true, unitCost: true },
      }),
    ]);

    const totalReceivables = customers.reduce((acc, c) => acc + c.outstandingBalance, 0);
    const totalPayables = suppliers.reduce((acc, s) => acc + s.outstandingBalance, 0);
    const totalInventoryCost = fifoLayers.reduce((acc, l) => acc + (l.remainingQuantity * l.unitCost), 0);

    // Calculate Trend Percentages
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return res.status(200).json({
      success: true,
      data: {
        today: {
          revenue: todayMetrics.revenue,
          revenueTrend: calcTrend(todayMetrics.revenue, yesterdayMetrics.revenue),
          transactions: todayMetrics.count,
          transactionsTrend: calcTrend(todayMetrics.count, yesterdayMetrics.count),
          grossProfit: todayMetrics.grossProfit,
          margin: todayMetrics.margin,
        },
        mtd: {
          revenue: mtdMetrics.revenue,
          revenueTrend: calcTrend(mtdMetrics.revenue, lmtdMetrics.revenue),
          cogs: mtdMetrics.cogs,
          grossProfit: mtdMetrics.grossProfit,
          margin: mtdMetrics.margin,
          marginTrend: mtdMetrics.margin - lmtdMetrics.margin, // Absolute variance
        },
        workingCapital: {
          receivables: totalReceivables,
          payables: totalPayables,
          inventoryCost: totalInventoryCost,
          netWorkingCapital: totalReceivables + totalInventoryCost - totalPayables,
        },
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch Executive KPIs: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate Executive BI KPIs', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Detailed Sales Analytics (Hourly, Daily, Payment, Basket Size)
 */
export const getSalesAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: 'PAID',
      },
      include: { items: true },
    });

    // 1. Hourly Sales Trend (0-23 hours)
    const hourlySales = Array.from({ length: 24 }, (_, i) => ({ hour: i, revenue: 0, count: 0 }));
    // 2. Day of Week Sales Trend (0-6 Sun-Sat)
    const weekdaySales = Array.from({ length: 7 }, (_, i) => ({ day: i, name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i], revenue: 0, count: 0 }));
    // 3. Payment Method distribution
    const paymentMethods: { [key: string]: number } = { CASH: 0, UPI: 0, CARD: 0, SPLIT: 0 };
    // 4. Basket Size Stats
    let totalItemsSold = 0;
    const basketSizes: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; // 5+ is grouped

    invoices.forEach(inv => {
      const hour = new Date(inv.createdAt).getHours();
      const day = new Date(inv.createdAt).getDay();

      hourlySales[hour].revenue += inv.grandTotal;
      hourlySales[hour].count += 1;

      weekdaySales[day].revenue += inv.grandTotal;
      weekdaySales[day].count += 1;

      if (paymentMethods[inv.paymentMethod] !== undefined) {
        paymentMethods[inv.paymentMethod] += inv.grandTotal;
      }

      let invQty = 0;
      inv.items.forEach(item => {
        invQty += item.quantity;
      });
      totalItemsSold += invQty;

      // Group basket sizes
      const sizeKey = invQty >= 5 ? 5 : invQty;
      basketSizes[sizeKey] = (basketSizes[sizeKey] || 0) + 1;
    });

    // Find peak hours
    const peakHours = [...hourlySales]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map(h => h.hour);

    return res.status(200).json({
      success: true,
      data: {
        hourlySales,
        weekdaySales,
        paymentMethods,
        basketSizes: Object.entries(basketSizes).map(([size, count]) => ({
          size: size === '5' ? '5+ Items' : `${size} Item(s)`,
          count,
        })),
        basketSummary: {
          totalTransactions: invoices.length,
          totalItemsSold,
          averageBasketSize: invoices.length > 0 ? totalItemsSold / invoices.length : 0,
        },
        peakHours,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch Sales Analytics: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate Sales Analytics', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Inventory Intelligence (ABC/XYZ, Ageing, Expiry, Velocity, Reorders)
 */
export const getInventoryIntelligence = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30));

    // 1. Fetch all products, active FIFO layers, and current warehouse stock
    const [products, fifoLayers, stockRecords, recentSales] = await Promise.all([
      prisma.product.findMany({
        include: {
          subCategory: { include: { category: true } },
        },
      }),
      prisma.fifoLayer.findMany({
        where: { remainingQuantity: { gt: 0 } },
        include: { product: true },
      }),
      prisma.warehouseStock.findMany({
        include: { product: true, warehouse: true },
      }),
      prisma.invoiceItem.findMany({
        where: {
          invoice: { createdAt: { gte: thirtyDaysAgo }, status: 'PAID' },
        },
        select: {
          productId: true,
          quantity: true,
          total: true,
          invoice: { select: { createdAt: true } },
        },
      }),
    ]);

    // 2. ABC/XYZ Analysis calculations
    const productRevenue: { [key: string]: number } = {};
    const productSalesDays: { [key: string]: Set<string> } = {};
    const productSalesQty: { [key: string]: number } = {};

    // Initialize
    products.forEach(p => {
      productRevenue[p.id] = 0;
      productSalesDays[p.id] = new Set<string>();
      productSalesQty[p.id] = 0;
    });

    recentSales.forEach(item => {
      if (productRevenue[item.productId] !== undefined) {
        productRevenue[item.productId] += item.total;
        productSalesQty[item.productId] += item.quantity;
        const dateStr = item.invoice.createdAt.toISOString().split('T')[0];
        productSalesDays[item.productId].add(dateStr);
      }
    });

    const totalRevenue30Days = Object.values(productRevenue).reduce((acc, r) => acc + r, 0) || 1;

    // Sort products by revenue descending
    const sortedProductsForABC = [...products]
      .map(p => ({
        id: p.id,
        name: p.name,

        revenue: productRevenue[p.id],
        salesDaysCount: productSalesDays[p.id].size,
        salesQty: productSalesQty[p.id],
      }))
      .sort((a, b) => b.revenue - a.revenue);

    let runningRevenue = 0;
    const abcXyzAnalysis = sortedProductsForABC.map(p => {
      runningRevenue += p.revenue;
      const pct = (runningRevenue / totalRevenue30Days) * 100;

      // ABC Category
      let abc = 'C';
      if (pct <= 70) abc = 'A';
      else if (pct <= 90) abc = 'B';

      // XYZ Category (based on demand frequency)
      let xyz = 'Z';
      if (p.salesDaysCount >= 15) xyz = 'X'; // Steady demand (at least every other day)
      else if (p.salesDaysCount >= 4) xyz = 'Y';  // Variable demand (at least weekly)

      return {
        id: p.id,
        name: p.name,

        class: `${abc}${xyz}`,
        revenue: p.revenue,
        salesQty: p.salesQty,
      };
    });

    // 3. FIFO Layer Ageing and Expiry Buckets
    const ageing = {
      bucket0to30: 0,
      bucket31to90: 0,
      bucket91to180: 0,
      bucket180plus: 0,
    };

    const expiry = {
      expired: 0,
      expiring0to30: 0,
      expiring31to90: 0,
      safe: 0,
    };

    fifoLayers.forEach(layer => {
      const value = layer.remainingQuantity * layer.unitCost;
      const ageDays = Math.floor((now.getTime() - layer.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Ageing
      if (ageDays <= 30) ageing.bucket0to30 += value;
      else if (ageDays <= 90) ageing.bucket31to90 += value;
      else if (ageDays <= 180) ageing.bucket91to180 += value;
      else ageing.bucket180plus += value;

      // Expiry
      if (layer.expiryDate) {
        const expiryDays = Math.ceil((layer.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (expiryDays <= 0) expiry.expired += value;
        else if (expiryDays <= 30) expiry.expiring0to30 += value;
        else if (expiryDays <= 90) expiry.expiring31to90 += value;
        else expiry.safe += value;
      } else {
        expiry.safe += value;
      }
    });

    // 4. Movement Velocity
    const velocity = {
      fast: abcXyzAnalysis.filter(p => p.salesQty >= 50).slice(0, 10),
      slow: abcXyzAnalysis.filter(p => p.salesQty > 0 && p.salesQty < 50).slice(0, 10),
      dead: abcXyzAnalysis.filter(p => p.salesQty === 0).slice(0, 10),
    };

    // 5. Stock Levels and Reorder Suggestions
    const reorders: any[] = [];
    let understockCount = 0;
    let overstockCount = 0;

    stockRecords.forEach(s => {
      if (s.quantity <= s.reorderLevel) {
        understockCount++;
        reorders.push({
          productId: s.productId,
          productName: s.product.name,

          warehouseId: s.warehouseId,
          warehouseName: s.warehouse.name,
          currentStock: s.quantity,
          reorderLevel: s.reorderLevel,
          suggestedReorderQty: (s.reorderLevel * 2) - s.quantity,
        });
      } else if (s.quantity >= s.reorderLevel * 4) {
        overstockCount++;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        abcXyz: abcXyzAnalysis,
        ageing,
        expiry,
        velocity,
        stockSummary: {
          understockCount,
          overstockCount,
          totalProductsCount: products.length,
        },
        reorders,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate Inventory Intelligence: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to generate Inventory Intelligence report', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};


