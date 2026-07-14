import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

/**
 * Get Total Inventory Valuation and Category Breakdown (FIFO-based)
 */
export const getValuation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const warehouseId = req.query.warehouseId as string;

    const whereClause: any = {
      remainingQuantity: { gt: 0 },
    };

    if (warehouseId) {
      whereClause.warehouseId = warehouseId;
    }

    // Fetch all active layers with their products and categories
    const activeLayers = await prisma.fifoLayer.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            subCategory: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    let totalValuation = 0;
    let totalItemsCount = 0;
    const categoryBreakdownMap = new Map<string, { name: string; value: number; count: number; }>();

    for (const layer of activeLayers) {
      const value = layer.remainingQuantity * layer.unitCost;
      totalValuation += value;
      totalItemsCount += layer.remainingQuantity;

      const categoryName = layer.product.subCategory?.category?.name || 'Uncategorized';
      const categoryId = layer.product.subCategory?.category?.id || 'uncategorized';

      const existing = categoryBreakdownMap.get(categoryId) || { name: categoryName, value: 0, count: 0 };
      existing.value += value;
      existing.count += layer.remainingQuantity;
      categoryBreakdownMap.set(categoryId, existing);
    }

    const categoryBreakdown = Array.from(categoryBreakdownMap.entries()).map(([id, stats]) => ({
      categoryId: id,
      categoryName: stats.name,
      value: Number(stats.value.toFixed(2)),
      count: stats.count,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalValuation: Number(totalValuation.toFixed(2)),
        totalItemsCount,
        uniqueProductsCount: new Set(activeLayers.map(l => l.productId)).size,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch inventory valuation: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to calculate inventory valuation', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get List of Active FIFO Cost Layers (with expiry warnings and age metrics)
 */
export const getLayers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const warehouseId = req.query.warehouseId as string;
    const productId = req.query.productId as string;
    const expiryStatus = req.query.expiryStatus as 'expiring_soon' | 'expired' | 'all';

    const skip = (page - 1) * limit;
    const where: any = {
      remainingQuantity: { gt: 0 },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (productId) {
      where.productId = productId;
    }

    const now = new Date();

    if (expiryStatus === 'expired') {
      where.expiryDate = { lt: now };
    } else if (expiryStatus === 'expiring_soon') {
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(now.getDate() + 30);
      where.expiryDate = {
        gte: now,
        lte: thirtyDaysLater,
      };
    }

    const [layers, total] = await Promise.all([
      prisma.fifoLayer.findMany({
        where,
        include: {
          product: {
            select: {
              name: true,

              barcode: true,
            },
          },
          warehouse: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.fifoLayer.count({ where }),
    ]);

    const layersWithAge = layers.map(layer => {
      const ageInDays = Math.floor((now.getTime() - layer.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      let isExpiringSoon = false;
      let isExpired = false;

      if (layer.expiryDate) {
        const expiryTime = layer.expiryDate.getTime();
        isExpired = expiryTime < now.getTime();
        isExpiringSoon = !isExpired && (expiryTime - now.getTime()) <= (30 * 24 * 60 * 60 * 1000);
      }

      return {
        ...layer,
        ageInDays,
        isExpired,
        isExpiringSoon,
      };
    });

    return res.status(200).json({
      success: true,
      data: layersWithAge,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch cost layers: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch inventory cost layers', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

/**
 * Get Recent FIFO Stock Consumption Traceability Timeline
 */
export const getConsumptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [consumptions, total] = await Promise.all([
      prisma.fifoConsumption.findMany({
        include: {
          product: { select: { name: true } },
          warehouse: { select: { name: true } },
          fifoLayer: {
            select: {
              batchNumber: true,
              lotNumber: true,
              expiryDate: true,
            },
          },
          invoiceItem: {
            select: {
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.fifoConsumption.count(),
    ]);

    return res.status(200).json({
      success: true,
      data: consumptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch consumptions: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch stock consumptions', code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};

