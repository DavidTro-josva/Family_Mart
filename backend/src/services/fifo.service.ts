import { Prisma } from '@prisma/client';

interface CreateLayerInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  landedCost?: number;
  grnItemId?: string | null;
  batchNumber?: string | null;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  manufacturingDate?: Date | null;
}

interface ConsumeStockInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  invoiceItemId?: string | null;
  inventoryTransactionId?: string | null;
}

/**
 * FIFO Costing Service
 */
export class FifoService {
  /**
   * Create a new FIFO cost layer when stock is added
   */
  static async createFifoLayer(
    tx: Prisma.TransactionClient,
    data: CreateLayerInput
  ) {
    const landedCost = data.landedCost || data.unitCost;

    return tx.fifoLayer.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        grnItemId: data.grnItemId || null,
        batchNumber: data.batchNumber || null,
        lotNumber: data.lotNumber || null,
        expiryDate: data.expiryDate || null,
        manufacturingDate: data.manufacturingDate || null,
        originalQuantity: data.quantity,
        remainingQuantity: data.quantity,
        unitCost: data.unitCost,
        landedCost,
      },
    });
  }

  /**
   * Consume stock from the oldest active layers (FIFO)
   * Returns the total cost of the consumed items
   */
  static async consumeFifoStock(
    tx: Prisma.TransactionClient,
    data: ConsumeStockInput
  ): Promise<number> {
    const { productId, warehouseId, quantity, invoiceItemId, inventoryTransactionId } = data;
    let remainingToConsume = quantity;
    let totalCost = 0;

    // Fetch active layers for the product in the warehouse, oldest first
    const activeLayers = await tx.fifoLayer.findMany({
      where: {
        productId,
        warehouseId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const layer of activeLayers) {
      if (remainingToConsume <= 0) break;

      const toConsumeFromLayer = Math.min(layer.remainingQuantity, remainingToConsume);
      
      // Update the layer's remaining quantity
      await tx.fifoLayer.update({
        where: { id: layer.id },
        data: {
          remainingQuantity: layer.remainingQuantity - toConsumeFromLayer,
        },
      });

      // Create a consumption record
      await tx.fifoConsumption.create({
        data: {
          productId,
          warehouseId,
          fifoLayerId: layer.id,
          invoiceItemId: invoiceItemId || null,
          inventoryTransactionId: inventoryTransactionId || null,
          quantityConsumed: toConsumeFromLayer,
          unitCost: layer.unitCost,
        },
      });

      totalCost += toConsumeFromLayer * layer.unitCost;
      remainingToConsume -= toConsumeFromLayer;
    }

    if (remainingToConsume > 0) {
      throw new Error(`Insufficient stock in FIFO layers to consume ${quantity} units of product ${productId}`);
    }

    return totalCost;
  }
}
