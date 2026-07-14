const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const FifoService = {
  consumeFifoStock: async (tx, data) => {
    const { productId, warehouseId, quantity, invoiceItemId, inventoryTransactionId } = data;
    let remainingToConsume = quantity;
    let totalCost = 0;

    const activeLayers = await tx.fifoLayer.findMany({
      where: {
        productId,
        warehouseId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    console.log('activeLayers found:', activeLayers.length);

    for (const layer of activeLayers) {
      if (remainingToConsume <= 0) break;
      const toConsumeFromLayer = Math.min(layer.remainingQuantity, remainingToConsume);
      await tx.fifoLayer.update({
        where: { id: layer.id },
        data: { remainingQuantity: layer.remainingQuantity - toConsumeFromLayer },
      });
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
};

async function main() {
  const productId = '446ed4e7-e4f0-4965-a1df-3dddac62ea86';
  const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-MAIN' } });
  
  await prisma.$transaction(async (tx) => {
    await FifoService.consumeFifoStock(tx, {
      productId,
      warehouseId: warehouse.id,
      quantity: 1,
      invoiceItemId: null,
      inventoryTransactionId: null
    });
  });
  console.log('Success!');
}

main().then(() => prisma.$disconnect()).catch(console.error);
