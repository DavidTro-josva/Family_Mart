const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const id = '446ed4e7-e4f0-4965-a1df-3dddac62ea86';
  const p = await prisma.product.findUnique({where: {id}});
  console.log('Product:', p);
  const layers = await prisma.fifoLayer.findMany({where: {productId: id}});
  console.log('Layers:', layers);
  const stocks = await prisma.warehouseStock.findMany({where: {productId: id}});
  console.log('Stocks:', stocks);
}
main().then(() => prisma.$disconnect()).catch(console.error);
