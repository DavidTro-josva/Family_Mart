import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';
import { 
  openRegisterSchema, 
  closeRegisterSchema, 
  regTransactionSchema, 
  customerPaymentSchema 
} from '../validations/finance.validation.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import crypto from 'crypto';

// ==========================================
// 1. CASH REGISTER CONTROLLER
// ==========================================

export const openRegister = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = openRegisterSchema.parse(req.body);
    const { openingFloat } = validated;

    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    // Check if there is already an open session for this cashier
    const activeSession = await prisma.registerSession.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN',
      },
    });

    if (activeSession) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'You already have an active open register session. Close it first.',
          code: 'REGISTER_ALREADY_OPEN',
        },
      });
    }

    const session = await prisma.registerSession.create({
      data: {
        cashierId: req.user.id,
        openingFloat,
        status: 'OPEN',
      },
    });

    res.status(201).json({
      success: true,
      data: { session },
    });
  } catch (err) {
    next(err);
  }
};

// Helper to calculate expected cash dynamically
const calculateExpectedCash = async (session: any) => {
  const closedAtFilter = session.closedAt || new Date();

  // 1. Get all Cash Sales (Invoices with CASH payment method)
  const cashInvoices = await prisma.invoice.findMany({
    where: {
      cashierId: session.cashierId,
      paymentMethod: 'CASH',
      createdAt: {
        gte: session.openedAt,
        lte: closedAtFilter,
      },
      status: 'PAID',
    },
  });
  const cashSales = cashInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);

  // 2. Get all Drawer Transactions (CASH_IN, CASH_OUT, SAFE_DROP)
  const txs = await prisma.registerTransaction.findMany({
    where: { sessionId: session.id },
  });

  let cashIn = 0;
  let cashOut = 0;
  let safeDrops = 0;

  txs.forEach((tx) => {
    if (tx.type === 'CASH_IN') cashIn += tx.amount;
    else if (tx.type === 'CASH_OUT') cashOut += tx.amount;
    else if (tx.type === 'SAFE_DROP') safeDrops += tx.amount;
  });

  const expectedCash = session.openingFloat + cashSales + cashIn - cashOut - safeDrops;
  return { expectedCash, cashSales, cashIn, cashOut, safeDrops };
};

export const getActiveRegister = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const session = await prisma.registerSession.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN',
      },
    });

    if (!session) {
      return res.status(200).json({
        success: true,
        data: { session: null },
      });
    }

    const { expectedCash, cashSales, cashIn, cashOut, safeDrops } = await calculateExpectedCash(session);

    res.status(200).json({
      success: true,
      data: {
        session: {
          ...session,
          expectedCash,
          cashSales,
          cashIn,
          cashOut,
          safeDrops,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const addRegisterTransaction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = regTransactionSchema.parse(req.body);
    const { type, amount, description } = validated;

    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const session = await prisma.registerSession.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN',
      },
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No active register session. Open a register first.',
          code: 'NO_ACTIVE_REGISTER',
        },
      });
    }

    const transaction = await prisma.registerTransaction.create({
      data: {
        sessionId: session.id,
        type: type as any,
        amount,
        description,
      },
    });

    res.status(201).json({
      success: true,
      data: { transaction },
    });
  } catch (err) {
    next(err);
  }
};

export const closeRegister = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = closeRegisterSchema.parse(req.body);
    const { actualCash, notes } = validated;

    if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const session = await prisma.registerSession.findFirst({
      where: {
        cashierId: req.user.id,
        status: 'OPEN',
      },
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No active register session to close.',
          code: 'NO_ACTIVE_REGISTER',
        },
      });
    }

    const { expectedCash } = await calculateExpectedCash(session);
    const variance = actualCash - expectedCash;

    const closedSession = await prisma.registerSession.update({
      where: { id: session.id },
      data: {
        closedAt: new Date(),
        expectedCash,
        actualCash,
        variance,
        status: 'CLOSED',
        notes,
      },
    });

    // Write Audit Log
    const correlationId = req.correlationId || crypto.randomUUID();
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        eventType: 'REGISTER_CLOSE',
        description: `Register closed. Expected: $${expectedCash.toFixed(2)}, Actual: $${actualCash.toFixed(2)}, Variance: $${variance.toFixed(2)}`,
        correlationId,
        ipAddress: req.ip,
        metadata: {
          sessionId: session.id,
          variance,
        },
      },
    });

    res.status(200).json({
      success: true,
      data: { session: closedSession },
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. CUSTOMER CREDIT CONTROLLER
// ==========================================

export const postCustomerPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = customerPaymentSchema.parse(req.body);
    const { customerId, amount, notes } = validated;

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer || !customer.isActive) {
        throw new Error('INVALID_CUSTOMER');
      }

      const previousBalance = customer.outstandingBalance;
      const newBalance = previousBalance - amount;

      // Update customer balance
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: { outstandingBalance: newBalance },
      });

      const correlationId = req.correlationId || crypto.randomUUID();

      // Create Ledger Entry
      const ledgerEntry = await tx.customerLedger.create({
        data: {
          customerId,
          type: 'PAYMENT',
          amount,
          previousBalance,
          newBalance,
          notes: notes || 'Credit Payment Received',
          correlationId,
        },
      });

      // Log Audit Event
      await tx.auditLog.create({
        data: {
          userId: req.user?.id || null,
          eventType: 'CREDIT_PAYMENT',
          description: `Credit payment of $${amount.toFixed(2)} received from customer ${customer.name}`,
          correlationId,
          ipAddress: req.ip,
          metadata: {
            customerId,
            amount,
          },
        },
      });

      return { customer: updatedCustomer, ledgerEntry };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err.message === 'INVALID_CUSTOMER') {
      return res.status(400).json({
        success: false,
        error: { message: 'Customer not found or inactive', code: 'INVALID_CUSTOMER' },
      });
    }
    next(err);
  }
};

export const getCustomerLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [ledger, total] = await Promise.all([
      prisma.customerLedger.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customerLedger.count({ where: { customerId } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ledger,
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

