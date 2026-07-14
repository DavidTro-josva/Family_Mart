const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stocks = await prisma.warehouseStock.findMany({ include: { product: true } });
  for (const stock of stocks) {
    const layers = await prisma.fifoLayer.findMany({ where: { productId: stock.productId, warehouseId: stock.warehouseId } });
    const totalFifo = layers.reduce((sum, l) => sum + l.remainingQuantity, 0);
    console.log(stock.product.name, 'Stock Qty:', stock.quantity, 'FIFO Qty:', totalFifo);
  }
}

main().then(() => prisma.$disconnect()).catch(console.error);
