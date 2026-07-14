import { Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const getDashboardSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Today's Sales Metrics
    const todayInvoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startOfToday },
        status: 'PAID',
      },
    });
    
    let todaySales = 0;
    let todayCredit = 0;
    
    todayInvoices.forEach(inv => {
      todaySales += inv.grandTotal;
      const details = inv.paymentDetails as any;
      if (details && typeof details.creditAmount === 'number') {
        todayCredit += details.creditAmount;
      }
    });
    
    const todayCollection = todaySales - todayCredit;
    const todayTransactions = todayInvoices.length;
    const todayAOV = todayTransactions > 0 ? todaySales / todayTransactions : 0;

    // 2. Monthly Sales Metrics
    const monthlyInvoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        status: 'PAID',
      },
    });
    const monthlySales = monthlyInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);

    // 3. Low Stock Count
    const allStocks = await prisma.warehouseStock.findMany({
      include: { product: true },
    });
    const lowStockCount = allStocks.filter((s) => s.quantity <= s.product.reorderLevel).length;

    // 4. Active Cashier Register Session
    const activeRegister = await prisma.registerSession.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN',
      },
    });

    // 5. Weekly Sales Trend (Last 7 Days)
    const weeklyTrend: { date: string; sales: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayInvoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          status: 'PAID',
        },
      });
      const daySales = dayInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
      weeklyTrend.push({
        date: d.toLocaleDateString(undefined, { weekday: 'short' }),
        sales: daySales,
      });
    }

    // 6. Payment Methods Split (Last 30 Days)
    const startOf30Days = new Date();
    startOf30Days.setDate(now.getDate() - 30);

    const recentInvoices30Days = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startOf30Days },
        status: 'PAID',
      },
    });

    const paymentSplit = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      SPLIT: 0,
    };
    recentInvoices30Days.forEach((inv) => {
      const method = inv.paymentMethod as keyof typeof paymentSplit;
      if (paymentSplit[method] !== undefined) {
        paymentSplit[method] += inv.grandTotal;
      }
    });

    // 7. Top Selling Products (Last 30 Days)
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        createdAt: { gte: startOf30Days },
        invoice: { status: 'PAID' },
      },
      include: { product: true },
    });

    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    invoiceItems.forEach((item) => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = {
          name: item.product.name,
          qty: 0,
          revenue: 0,
        };
      }
      productSalesMap[item.productId].qty += item.quantity;
      productSalesMap[item.productId].revenue += item.total;
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 8. Recent Invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        cashier: { select: { username: true } },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          todaySales,
          todayCollection,
          todayCredit,
          todayTransactions,
          todayAOV,
          monthlySales,
          lowStockCount,
          isRegisterOpen: !!activeRegister,
        },
        weeklyTrend,
        paymentSplit,
        topProducts,
        recentInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
};

