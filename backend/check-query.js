const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const productId = '446ed4e7-e4f0-4965-a1df-3dddac62ea86';
  const warehouseId = '19ebd4f5-112f-49fd-8839-481da86f384f';
  
  const activeLayers = await prisma.fifoLayer.findMany({
    where: {
      productId,
      warehouseId,
      remainingQuantity: { gt: 0 },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
  console.log('Active layers query result:', activeLayers);
}
main().then(() => prisma.$disconnect()).catch(console.error);
