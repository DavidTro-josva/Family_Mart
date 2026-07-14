import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Users (with hashed passwords)
  console.log('🔑 Seeding users...');
  const salt = await bcrypt.genSalt(10);
  
  const adminPassword = await bcrypt.hash('Admin@123', salt);
  const managerPassword = await bcrypt.hash('Manager@123', salt);
  const cashierPassword = await bcrypt.hash('Cashier@123', salt);
  const clerkPassword = await bcrypt.hash('Clerk@123', salt);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      password: managerPassword,
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {},
    create: {
      username: 'cashier',
      password: cashierPassword,
      role: 'CASHIER',
    },
  });

  await prisma.user.upsert({
    where: { username: 'clerk' },
    update: {},
    create: {
      username: 'clerk',
      password: clerkPassword,
      role: 'INVENTORY_CLERK',
    },
  });

  // 2. Seed Default Warehouse
  console.log('🏠 Seeding warehouses...');
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-MAIN' },
    update: {},
    create: {
      name: 'Main Store Warehouse',
      code: 'WH-MAIN',
      address: 'Family Mart Main Store, 123 Retail Lane',
    },
  });

  // 3. Seed GST Categories
  console.log('💵 Seeding GST categories...');
  const gst0 = await prisma.gstCategory.upsert({
    where: { code: 'GST-0' },
    update: {},
    create: { name: 'Exempt / Zero Rate', code: 'GST-0', rate: 0 },
  });

  const gst5 = await prisma.gstCategory.upsert({
    where: { code: 'GST-5' },
    update: {},
    create: { name: 'GST 5%', code: 'GST-5', rate: 5 },
  });

  const gst12 = await prisma.gstCategory.upsert({
    where: { code: 'GST-12' },
    update: {},
    create: { name: 'GST 12%', code: 'GST-12', rate: 12 },
  });

  const gst18 = await prisma.gstCategory.upsert({
    where: { code: 'GST-18' },
    update: {},
    create: { name: 'GST 18%', code: 'GST-18', rate: 18 },
  });

  // 4. Seed Units
  console.log('📦 Seeding units...');
  const unitPcs = await prisma.unit.upsert({
    where: { name: 'Pieces' },
    update: {},
    create: { name: 'Pieces', abbreviation: 'Pcs' },
  });

  const unitKg = await prisma.unit.upsert({
    where: { name: 'Kilograms' },
    update: {},
    create: { name: 'Kilograms', abbreviation: 'Kg' },
  });

  const unitLtr = await prisma.unit.upsert({
    where: { name: 'Liters' },
    update: {},
    create: { name: 'Liters', abbreviation: 'Ltr' },
  });

  // 5. Seed Categories & Subcategories
  console.log('📂 Seeding categories...');
  const catGrocery = await prisma.category.upsert({
    where: { name: 'Grocery' },
    update: {},
    create: { name: 'Grocery', description: 'Daily grocery items' },
  });

  const catBeverage = await prisma.category.upsert({
    where: { name: 'Beverages' },
    update: {},
    create: { name: 'Beverages', description: 'Soft drinks, juices, and water' },
  });

  const subRice = await prisma.subCategory.upsert({
    where: { name: 'Rice & Grains' },
    update: {},
    create: { name: 'Rice & Grains', categoryId: catGrocery.id },
  });

  const subOil = await prisma.subCategory.upsert({
    where: { name: 'Edible Oils' },
    update: {},
    create: { name: 'Edible Oils', categoryId: catGrocery.id },
  });

  const subSoda = await prisma.subCategory.upsert({
    where: { name: 'Soft Drinks' },
    update: {},
    create: { name: 'Soft Drinks', categoryId: catBeverage.id },
  });

  // 6. Seed Brands
  console.log('🏷️ Seeding brands...');
  const brandCoke = await prisma.brand.upsert({
    where: { name: 'Coca Cola' },
    update: {},
    create: { name: 'Coca Cola' },
  });

  const brandFortune = await prisma.brand.upsert({
    where: { name: 'Fortune' },
    update: {},
    create: { name: 'Fortune' },
  });

  const brandBasmati = await prisma.brand.upsert({
    where: { name: 'Basmati' },
    update: {},
    create: { name: 'Basmati' },
  });

  // 7. Seed Suppliers
  console.log('🤝 Seeding suppliers...');
  const supplier = await prisma.supplier.upsert({
    where: { phone: '1112223333' },
    update: {},
    create: {
      name: 'Alpha Distributors',
      contactName: 'Alice Smith',
      phone: '1112223333',
      email: 'orders@alphadist.com',
      address: '45 Supply Road, Industrial Area',
      gstin: '27GSTIN1234A1Z1',
    },
  });

  // 8. Seed Customers
  console.log('👥 Seeding customers...');
  const walkin = await prisma.customer.upsert({
    where: { phone: '0000000000' },
    update: {},
    create: {
      name: 'Walk-in Customer',
      phone: '0000000000',
      creditLimit: 0,
      outstandingBalance: 0,
    },
  });

  const creditCustomer = await prisma.customer.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      name: 'John Doe',
      phone: '9876543210',
      email: 'john@doe.com',
      address: '74 Oak Avenue, Suburbia',
      creditLimit: 500.00,
      outstandingBalance: 0.00,
    },
  });

  // 9. Seed Products & Warehouse Stock
  console.log('🍎 Seeding products...');
  const prodRice = await prisma.product.upsert({
    where: { barcode: '8901234567890' },
    update: {},
    create: {
      name: 'Basmati Rice 5kg',
      barcode: '8901234567890',
      sku: 'RICE-BAS-5K',
      description: 'Premium long grain basmati rice',
      categoryId: catGrocery.id,
      subCategoryId: subRice.id,
      brandId: brandBasmati.id,
      unitId: unitKg.id,
      gstCategoryId: gst5.id,
      supplierId: supplier.id,
      mrp: 15.00,
      sellingPrice: 13.50,
      costPrice: 10.00,
      reorderLevel: 20,
    },
  });

  const prodCoke = await prisma.product.upsert({
    where: { barcode: '5449000000996' },
    update: {},
    create: {
      name: 'Coca Cola 500ml',
      barcode: '5449000000996',
      sku: 'BEV-COKE-500',
      description: 'Refreshing soft drink',
      categoryId: catBeverage.id,
      subCategoryId: subSoda.id,
      brandId: brandCoke.id,
      unitId: unitPcs.id,
      gstCategoryId: gst18.id,
      supplierId: supplier.id,
      mrp: 2.00,
      sellingPrice: 1.80,
      costPrice: 1.20,
      reorderLevel: 50,
    },
  });

  const prodOil = await prisma.product.upsert({
    where: { barcode: '8906007281014' },
    update: {},
    create: {
      name: 'Fortune Sunflower Oil 1L',
      barcode: '8906007281014',
      sku: 'OIL-FOR-1L',
      description: 'Refined sunflower cooking oil',
      categoryId: catGrocery.id,
      subCategoryId: subOil.id,
      brandId: brandFortune.id,
      unitId: unitLtr.id,
      gstCategoryId: gst12.id,
      supplierId: supplier.id,
      mrp: 5.00,
      sellingPrice: 4.50,
      costPrice: 3.50,
      reorderLevel: 30,
    },
  });

  // 10. Seed Stock levels in WH-MAIN
  console.log('📈 Seeding stocks...');
  const products = [
    { id: prodRice.id, qty: 100, bin: 'AISLE-1-SHELF-2' },
    { id: prodCoke.id, qty: 250, bin: 'FRIDGE-2' },
    { id: prodOil.id, qty: 120, bin: 'AISLE-2-SHELF-1' },
  ];

  for (const item of products) {
    await prisma.warehouseStock.upsert({
      where: {
        productId_warehouseId: {
          productId: item.id,
          warehouseId: warehouse.id,
        },
      },
      update: {
        quantity: item.qty,
        binCode: item.bin,
      },
      create: {
        productId: item.id,
        warehouseId: warehouse.id,
        quantity: item.qty,
        binCode: item.bin,
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed with error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
