const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(__dirname, 'triggers.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying database triggers and constraints...');
  await prisma.$executeRawUnsafe(sql);
  console.log('Database triggers and constraints applied successfully.');
}

main()
  .catch(e => {
    console.error('Failed to apply triggers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
