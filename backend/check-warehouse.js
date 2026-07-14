const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.warehouse.findMany().then(w => {
  console.log('Warehouses:', w);
  prisma.$disconnect();
});
