const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Users — Admin only
  console.log('🔑 Seeding admin user...');
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@123', salt);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@familymart.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
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
    where: { name: 'Exempt / Zero Rate' },
    update: {},
    create: { name: 'Exempt / Zero Rate', rate: 0 },
  });

  const gst5 = await prisma.gstCategory.upsert({
    where: { name: 'GST 5%' },
    update: {},
    create: { name: 'GST 5%', rate: 5 },
  });

  const gst12 = await prisma.gstCategory.upsert({
    where: { name: 'GST 12%' },
    update: {},
    create: { name: 'GST 12%', rate: 12 },
  });

  const gst18 = await prisma.gstCategory.upsert({
    where: { name: 'GST 18%' },
    update: {},
    create: { name: 'GST 18%', rate: 18 },
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
    where: { name_categoryId: { name: 'Rice & Grains', categoryId: catGrocery.id } },
    update: {},
    create: { name: 'Rice & Grains', categoryId: catGrocery.id },
  });

  const subOil = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'Edible Oils', categoryId: catGrocery.id } },
    update: {},
    create: { name: 'Edible Oils', categoryId: catGrocery.id },
  });

  const subSoda = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'Soft Drinks', categoryId: catBeverage.id } },
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
    where: { name: 'Alpha Distributors' },
    update: {},
    create: {
      name: 'Alpha Distributors',
      contactName: 'Alice Smith',
      phone: '1112223333',
      email: 'orders@alphadist.com',
      address: '45 Supply Road, Industrial Area',
      gstIn: '27GSTIN1234A1Z1',
    },
  });

  // 8. Seed Customers
  console.log('👥 Seeding customers...');
  await prisma.customer.upsert({
    where: { phone: '0000000000' },
    update: {},
    create: {
      name: 'Walk-in Customer',
      phone: '0000000000',
      creditLimit: 0,
      outstandingBalance: 0,
    },
  });

  await prisma.customer.upsert({
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
      description: 'Premium long grain basmati rice',
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
      description: 'Refreshing soft drink',
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
      description: 'Refined sunflower cooking oil',
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

  // 11. Seed New Products
  const subSpices = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'Spices', categoryId: catGrocery.id } },
    update: {},
    create: { name: 'Spices', categoryId: catGrocery.id },
  });
  const subSnacks = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'Snacks', categoryId: catGrocery.id } },
    update: {},
    create: { name: 'Snacks', categoryId: catGrocery.id },
  });
  const subPersonalCare = await prisma.subCategory.upsert({
    where: { name_categoryId: { name: 'Personal Care', categoryId: catGrocery.id } },
    update: {},
    create: { name: 'Personal Care', categoryId: catGrocery.id },
  });

  const brandEverest = await prisma.brand.upsert({
    where: { name: 'Everest' },
    update: {},
    create: { name: 'Everest' },
  });
  const brandBritannia = await prisma.brand.upsert({
    where: { name: 'Britannia' },
    update: {},
    create: { name: 'Britannia' },
  });
  const brandColgate = await prisma.brand.upsert({
    where: { name: 'Colgate' },
    update: {},
    create: { name: 'Colgate' },
  });
  const brandOralB = await prisma.brand.upsert({
    where: { name: 'Oral-B' },
    update: {},
    create: { name: 'Oral-B' },
  });

  const prodMasala = await prisma.product.upsert({
    where: { barcode: '8901234511111' },
    update: {},
    create: {
      name: 'Everest Garam Masala 100g',
      barcode: '8901234511111',
      description: 'Authentic Indian spice mix',
      subCategoryId: subSpices.id,
      brandId: brandEverest.id,
      unitId: unitPcs.id,
      gstCategoryId: gst12.id,
      supplierId: supplier.id,
      mrp: 80.00,
      sellingPrice: 75.00,
      costPrice: 60.00,
      reorderLevel: 25,
    },
  });

  const prodBiscuits = await prisma.product.upsert({
    where: { barcode: '8901234522222' },
    update: {},
    create: {
      name: 'Britannia Good Day 250g',
      barcode: '8901234522222',
      description: 'Butter cookies',
      subCategoryId: subSnacks.id,
      brandId: brandBritannia.id,
      unitId: unitPcs.id,
      gstCategoryId: gst12.id,
      supplierId: supplier.id,
      mrp: 50.00,
      sellingPrice: 48.00,
      costPrice: 38.00,
      reorderLevel: 40,
    },
  });

  const prodToothpaste = await prisma.product.upsert({
    where: { barcode: '8901234533333' },
    update: {},
    create: {
      name: 'Colgate MaxFresh 150g',
      barcode: '8901234533333',
      description: 'Cooling crystal toothpaste',
      subCategoryId: subPersonalCare.id,
      brandId: brandColgate.id,
      unitId: unitPcs.id,
      gstCategoryId: gst18.id,
      supplierId: supplier.id,
      mrp: 110.00,
      sellingPrice: 105.00,
      costPrice: 85.00,
      reorderLevel: 30,
    },
  });

  const prodBrush = await prisma.product.upsert({
    where: { barcode: '8901234544444' },
    update: {},
    create: {
      name: 'Oral-B Pro Toothbrush',
      barcode: '8901234544444',
      description: 'Soft bristle toothbrush',
      subCategoryId: subPersonalCare.id,
      brandId: brandOralB.id,
      unitId: unitPcs.id,
      gstCategoryId: gst18.id,
      supplierId: supplier.id,
      mrp: 40.00,
      sellingPrice: 38.00,
      costPrice: 25.00,
      reorderLevel: 50,
    },
  });

  const newProducts = [
    { id: prodMasala.id, qty: 85, bin: 'AISLE-3-SHELF-1' },
    { id: prodBiscuits.id, qty: 150, bin: 'AISLE-4-SHELF-2' },
    { id: prodToothpaste.id, qty: 90, bin: 'AISLE-5-SHELF-1' },
    { id: prodBrush.id, qty: 120, bin: 'AISLE-5-SHELF-2' },
  ];

  for (const item of newProducts) {
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
