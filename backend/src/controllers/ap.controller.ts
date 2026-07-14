import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { SupplierLedgerEntryType, SupplierPaymentMethod, RegisterStatus, RegTxType } from '@prisma/client';

/**
 * Helper to generate Payment Voucher Number: PV-YYYYMMDD-XXXX
 */
async function generatePaymentNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.supplierPayment.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  return `PV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
}

/**
 * Fetch Suppliers with Outstanding AP Balance and 30/60/90 Days Aging
 */
export const getSuppliersAP = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        invoices: {
          where: { status: 'POSTED' },
          include: { payments: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const now = new Date();

    const apRecords = suppliers.map(sup => {
      // Calculate aging buckets
      let aging0to30 = 0;
      let aging31to60 = 0;
      let aging61to90 = 0;
      let agingOver90 = 0;

      sup.invoices.forEach(inv => {
        // Calculate remaining balance on the invoice
        const totalPaid = inv.payments.reduce((acc, p) => acc + p.amount, 0);
        const remainingBalance = Math.max(0, inv.grandTotal - totalPaid);

        if (remainingBalance > 0) {
          const ageInMs = now.getTime() - new Date(inv.invoiceDate).getTime();
          const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

          if (ageInDays <= 30) {
            aging0to30 += remainingBalance;
          } else if (ageInDays <= 60) {
            aging31to60 += remainingBalance;
          } else if (ageInDays <= 90) {
            aging61to90 += remainingBalance;
          } else {
            agingOver90 += remainingBalance;
          }
        }
      });

      return {
        id: sup.id,
        name: sup.name,
        contactName: sup.contactName,
        phone: sup.phone,
        email: sup.email,
        creditPeriod: sup.creditPeriod,
        creditLimit: sup.creditLimit,
        outstandingBalance: sup.outstandingBalance,
        aging: {
          bucket0to30: aging0to30,
          bucket31to60: aging31to60,
          bucket61to90: aging61to90,
          bucketOver90: agingOver90,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: apRecords,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch AP aging: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch Accounts Payable aging report', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Record a Supplier Payment Voucher (AP Payment Posting)
 */
export const createSupplierPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { supplierId, amount, paymentMethod, referenceNumber, notes, invoiceId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: { message: 'Supplier not found', code: 'NOT_FOUND' },
      });
    }

    // Verify Cash Register Session if paying by CASH
    let activeSession = null;
    if (paymentMethod === SupplierPaymentMethod.CASH) {
      activeSession = await prisma.registerSession.findFirst({
        where: {
          cashierId: userId,
          status: RegisterStatus.OPEN,
        },
      });

      if (!activeSession) {
        return res.status(400).json({
          success: false,
          error: { message: 'No active cash register session found. Please open register first.', code: 'NO_ACTIVE_REGISTER' },
        });
      }

      if (activeSession.expectedCash < amount) {
        return res.status(400).json({
          success: false,
          error: { message: `Insufficient cash in drawer. Available: $${activeSession.expectedCash.toFixed(2)}`, code: 'INSUFFICIENT_DRAWER_CASH' },
        });
      }
    }

    const paymentNumber = await generatePaymentNumber();
    const correlationId = req.correlationId || 'AP_PAYMENT';

    const payment = await prisma.$transaction(async (tx) => {
      const previousBalance = supplier.outstandingBalance;
      const newBalance = previousBalance - amount;

      // 1. Update Supplier Outstanding Balance
      await tx.supplier.update({
        where: { id: supplierId },
        data: { outstandingBalance: newBalance },
      });

      // 2. Create SupplierPayment
      const pay = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId,
          invoiceId: invoiceId || null,
          amount,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          createdById: userId,
        },
      });

      // 3. Create SupplierLedger entry (Type: PAYMENT / ADVANCE)
      const ledgerType = newBalance < 0 ? SupplierLedgerEntryType.ADVANCE : SupplierLedgerEntryType.PAYMENT;
      await tx.supplierLedger.create({
        data: {
          supplierId,
          type: ledgerType,
          amount,
          previousBalance,
          newBalance,
          invoiceId: invoiceId || null,
          notes: notes || `Payment Voucher ${paymentNumber} via ${paymentMethod}`,
          correlationId: paymentNumber,
        },
      });

      // 4. Record Cash Register Payout if CASH
      if (paymentMethod === SupplierPaymentMethod.CASH && activeSession) {
        await tx.registerTransaction.create({
          data: {
            sessionId: activeSession.id,
            type: RegTxType.CASH_OUT,
            amount,
            description: `Supplier Payment Payout ${paymentNumber}`,
          },
        });

        await tx.registerSession.update({
          where: { id: activeSession.id },
          data: {
            expectedCash: activeSession.expectedCash - amount,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'AP_PAYMENT_CREATE',
          description: `Created Supplier Payment ${paymentNumber} for Supplier ${supplier.name} ($${amount.toFixed(2)})`,
          correlationId,
          metadata: {
            paymentId: pay.id,
            paymentNumber,
            supplierId,
            amount,
          },
        },
      });

      return pay;
    });

    logger.info(`Supplier Payment ${paymentNumber} recorded by user ${userId}`);

    return res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    logger.error(`Failed to record Supplier Payment: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to record supplier payment', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated Supplier Ledger Entries
 */
export const getSupplierLedger = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { supplierId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.supplierLedger.findMany({
        where: { supplierId },
        include: {
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supplierLedger.count({ where: { supplierId } }),
    ]);

    return res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch supplier ledger: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch supplier ledger', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated Supplier Payments
 */
export const getSupplierPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { supplierId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.supplierPayment.findMany({
        where: { supplierId },
        include: {
          invoice: { select: { invoiceNumber: true } },
          createdBy: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supplierPayment.count({ where: { supplierId } }),
    ]);

    return res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch supplier payments: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch supplier payments', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

