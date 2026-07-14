const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.product.findMany({ select: { name: true, reorderLevel: true } })
  .then(res => console.log('Product Reorder Levels:', res))
  .then(() => prisma.warehouseStock.findMany({ include: { product: true } }))
  .then(res => console.log('WarehouseStock info:', res.map(s => ({ name: s.product.name, qty: s.quantity, reorderLevel: s.reorderLevel }))))
  .finally(() => prisma.$disconnect());
