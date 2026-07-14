import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { SupplierInvoiceStatus, MatchStatus, SupplierLedgerEntryType } from '@prisma/client';

/**
 * Create a Supplier Invoice & Run Three-Way Matching
 */
export const createSupplierInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      invoiceNumber,
      invoiceDate,
      dueDate,
      supplierId,
      purchaseOrderId,
      goodsReceiptId,
      subTotal,
      taxAmount,
      grandTotal,
      remarks,
      items,
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    // Check for duplicate invoice number for this supplier
    const duplicate = await prisma.supplierInvoice.findUnique({
      where: {
        supplierId_invoiceNumber: {
          supplierId,
          invoiceNumber,
        },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: { message: 'Duplicate invoice number for this supplier', code: 'DUPLICATE_INVOICE' },
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

    // Fetch PO and GRN if provided for Three-Way Matching
    const [po, grn] = await Promise.all([
      purchaseOrderId
        ? prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            include: { items: true },
          })
        : null,
      goodsReceiptId
        ? prisma.goodsReceipt.findUnique({
            where: { id: goodsReceiptId },
            include: { items: true },
          })
        : null,
    ]);

    // Run Three-Way Match Engine
    let matchStatus: MatchStatus = MatchStatus.PERFECT_MATCH;
    const varianceNotes: string[] = [];

    if (po || grn) {
      for (const invItem of items) {
        // Compare with PO (Price Verification)
        if (po) {
          const poItem = po.items.find(i => i.productId === invItem.productId);
          if (!poItem) {
            matchStatus = MatchStatus.MULTI_VARIANCE;
            varianceNotes.push(`Product ${invItem.productId} not in PO.`);
          } else if (Math.abs(invItem.unitPrice - poItem.unitCost) > 0.01) {
            if (matchStatus === MatchStatus.PERFECT_MATCH) {
              matchStatus = MatchStatus.PRICE_VARIANCE;
            } else if (matchStatus !== MatchStatus.PRICE_VARIANCE) {
              matchStatus = MatchStatus.MULTI_VARIANCE;
            }
            varianceNotes.push(
              `Price variance on Product ${invItem.productId}: Invoiced $${invItem.unitPrice} vs Ordered $${poItem.unitCost}.`
            );
          }
        }

        // Compare with GRN (Quantity Verification)
        if (grn) {
          const grnItem = grn.items.find(i => i.productId === invItem.productId);
          if (!grnItem) {
            matchStatus = MatchStatus.MULTI_VARIANCE;
            varianceNotes.push(`Product ${invItem.productId} not in GRN.`);
          } else {
            // Quantity received that passed inspection
            const qtyReceived = grnItem.quantityReceived;
            if (invItem.quantity > qtyReceived) {
              if (matchStatus === MatchStatus.PERFECT_MATCH) {
                matchStatus = MatchStatus.QTY_VARIANCE;
              } else if (matchStatus !== MatchStatus.QTY_VARIANCE) {
                matchStatus = MatchStatus.MULTI_VARIANCE;
              }
              varianceNotes.push(
                `Quantity variance on Product ${invItem.productId}: Invoiced ${invItem.quantity} vs Received ${qtyReceived}.`
              );
            }
          }
        }
      }
    }

    // Determine initial invoice status
    const status: SupplierInvoiceStatus =
      matchStatus === MatchStatus.PERFECT_MATCH
        ? SupplierInvoiceStatus.MATCHED
        : SupplierInvoiceStatus.PENDING_MATCH;

    const finalRemarks = remarks 
      ? `${remarks}\n\nMatching Results:\n${varianceNotes.join('\n')}`
      : `Matching Results:\n${varianceNotes.join('\n')}`;

    const correlationId = req.correlationId || 'SUPPLIER_INVOICE_CREATE';

    const newInvoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.supplierInvoice.create({
        data: {
          invoiceNumber,
          invoiceDate: new Date(invoiceDate),
          dueDate: new Date(dueDate),
          supplierId,
          purchaseOrderId: purchaseOrderId || null,
          goodsReceiptId: goodsReceiptId || null,
          subTotal,
          taxAmount,
          grandTotal,
          status,
          matchStatus,
          createdById: userId,
          remarks: finalRemarks,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxAmount: item.taxAmount,
              total: item.total,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          supplier: true,
          purchaseOrder: true,
          goodsReceipt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'SUPPLIER_INVOICE_CREATE',
          description: `Created Supplier Invoice ${invoiceNumber} for Supplier ${supplier.name} with match status: ${matchStatus}`,
          correlationId,
          metadata: {
            invoiceId: inv.id,
            invoiceNumber,
            matchStatus,
            status,
          },
        },
      });

      return inv;
    });

    logger.info(`Supplier Invoice ${invoiceNumber} created by user ${userId}`);

    return res.status(201).json({
      success: true,
      data: newInvoice,
    });
  } catch (error: any) {
    logger.error(`Failed to create Supplier Invoice: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to create supplier invoice', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Approve / Reject / Post Supplier Invoice (AP Accrual Posting)
 */
export const approveAndPostInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
    }

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { message: 'Supplier Invoice not found', code: 'NOT_FOUND' },
      });
    }

    if (invoice.status === SupplierInvoiceStatus.POSTED) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invoice is already posted and cannot be modified', code: 'ALREADY_POSTED' },
      });
    }

    const correlationId = req.correlationId || 'SUPPLIER_INVOICE_POST';

    const updated = await prisma.$transaction(async (tx) => {
      let finalRemarks = invoice.remarks || '';
      if (remarks) {
        finalRemarks += `\n[Manager Override]: ${remarks}`;
      }

      // If posting, accrue outstanding balance on supplier
      if (status === SupplierInvoiceStatus.POSTED) {
        const supplier = await tx.supplier.findUnique({ where: { id: invoice.supplierId } });
        if (!supplier) {
          throw new Error('Supplier not found');
        }

        const previousBalance = supplier.outstandingBalance;
        const newBalance = previousBalance + invoice.grandTotal;

        // Update supplier outstanding balance
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { outstandingBalance: newBalance },
        });

        // Log SupplierLedger entry (Type: INVOICE)
        await tx.supplierLedger.create({
          data: {
            supplierId: invoice.supplierId,
            type: SupplierLedgerEntryType.INVOICE,
            amount: invoice.grandTotal,
            previousBalance,
            newBalance,
            invoiceId: invoice.id,
            notes: `Posted Invoice ${invoice.invoiceNumber}`,
            correlationId: invoice.id,
          },
        });
      }

      const inv = await tx.supplierInvoice.update({
        where: { id },
        data: {
          status,
          remarks: finalRemarks,
          updatedAt: new Date(),
        },
        include: {
          items: { include: { product: true } },
          supplier: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'SUPPLIER_INVOICE_POST',
          description: `Updated Supplier Invoice ${invoice.invoiceNumber} status to ${status}`,
          correlationId,
          metadata: {
            invoiceId: id,
            status,
          },
        },
      });

      return inv;
    });

    logger.info(`Supplier Invoice ${invoice.invoiceNumber} updated to ${status} by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error(`Failed to update Supplier Invoice: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to update supplier invoice', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Paginated Supplier Invoices
 */
export const getSupplierInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const statusParam = req.query.status as string;
    const search = req.query.search as string;

    const validStatuses = Object.values(SupplierInvoiceStatus);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (statusParam && validStatuses.includes(statusParam as SupplierInvoiceStatus)) {
      where.status = statusParam as SupplierInvoiceStatus;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } },
          goodsReceipt: { select: { grnNumber: true } },
          createdBy: { select: { username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch supplier invoices: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch supplier invoices', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Detailed Supplier Invoice
 */
export const getSupplierInvoiceDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: {
          include: {
            items: true,
          },
        },
        goodsReceipt: {
          include: {
            items: true,
          },
        },
        createdBy: { select: { username: true } },
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

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { message: 'Supplier Invoice not found', code: 'NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    logger.error(`Failed to fetch supplier invoice details: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch supplier invoice details', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

