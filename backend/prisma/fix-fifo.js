const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking for missing FIFO layers...');
  const stocks = await prisma.warehouseStock.findMany({ include: { product: true } });
  for (const s of stocks) {
    const layerCount = await prisma.fifoLayer.count({
      where: { productId: s.productId, warehouseId: s.warehouseId }
    });
    if (layerCount === 0 && s.quantity > 0) {
      await prisma.fifoLayer.create({
        data: {
          productId: s.productId,
          warehouseId: s.warehouseId,
          originalQuantity: s.quantity,
          remainingQuantity: s.quantity,
          unitCost: s.product.costPrice,
        }
      });
      console.log(`Created FIFO layer for ${s.product.name} (${s.quantity} units)`);
    }
  }
  console.log('Done!');
}
main().finally(() => prisma.$disconnect());
