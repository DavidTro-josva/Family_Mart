const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stocks = await prisma.warehouseStock.findMany({
    include: { product: true }
  });

  let createdCount = 0;

  for (const stock of stocks) {
    if (stock.quantity > 0) {
      // Check if a FIFO layer exists for this product in this warehouse
      const existingLayers = await prisma.fifoLayer.findMany({
        where: {
          productId: stock.productId,
          warehouseId: stock.warehouseId
        }
      });

      // Calculate how much stock is already in FIFO layers
      const totalFifoQuantity = existingLayers.reduce((sum, layer) => sum + layer.remainingQuantity, 0);

      const missingQuantity = stock.quantity - totalFifoQuantity;

      if (missingQuantity > 0) {
        await prisma.fifoLayer.create({
          data: {
            productId: stock.productId,
            warehouseId: stock.warehouseId,
            originalQuantity: missingQuantity,
            remainingQuantity: missingQuantity,
            unitCost: stock.product.costPrice || 0,
            landedCost: stock.product.costPrice || 0
          }
        });
        createdCount++;
        console.log(`Created FIFO layer for product ${stock.product.name} with quantity ${missingQuantity}`);
      }
    }
  }

  console.log(`Finished checking stocks. Created ${createdCount} missing FIFO layers.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
