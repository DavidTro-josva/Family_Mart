const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barcodes = ['195357', '123456789'];
  
  for (const barcode of barcodes) {
    const product = await prisma.product.findUnique({ where: { barcode } });
    if (product) {
      console.log(`Found product: ${product.name} with barcode ${barcode}`);
      
      // Delete related FifoConsumption first
      await prisma.fifoConsumption.deleteMany({ where: { productId: product.id } });
      
      // Delete related FifoLayer
      await prisma.fifoLayer.deleteMany({ where: { productId: product.id } });
      
      // Delete related WarehouseStock
      await prisma.warehouseStock.deleteMany({ where: { productId: product.id } });
      
      try {
        // Attempt to delete product
        await prisma.product.delete({ where: { id: product.id } });
        console.log(`Successfully hard deleted product: ${barcode}`);
      } catch (err) {
        console.log(`Could not hard delete ${barcode}, likely due to existing invoices. Soft deleting instead...`);
        await prisma.product.update({
          where: { id: product.id },
          data: { isActive: false }
        });
        console.log(`Soft deleted product: ${barcode}`);
      }
    } else {
      console.log(`Product with barcode ${barcode} not found.`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
