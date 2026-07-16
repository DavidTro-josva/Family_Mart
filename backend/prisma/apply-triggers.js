const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(__dirname, 'triggers.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying database triggers and constraints...');
  const statements = [
    `CREATE OR REPLACE FUNCTION log_stock_change()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
        INSERT INTO "AuditLog" ("id", "userId", "eventType", "description", "correlationId", "metadata", "createdAt")
        VALUES (
          gen_random_uuid(),
          NULL,
          'DATABASE_STOCK_TRIGGER',
          'Stock updated for Product ID ' || NEW."productId" || ' in Warehouse ID ' || NEW."warehouseId" || ': ' || OLD.quantity || ' -> ' || NEW.quantity,
          'DB_TRIGGER',
          json_build_object('productId', NEW."productId", 'warehouseId', NEW."warehouseId", 'oldQty', OLD.quantity, 'newQty', NEW.quantity),
          NOW()
        );
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;`,
    `DROP TRIGGER IF EXISTS after_stock_update ON "WarehouseStock";`,
    `CREATE TRIGGER after_stock_update
    AFTER UPDATE ON "WarehouseStock"
    FOR EACH ROW
    EXECUTE FUNCTION log_stock_change();`,
    `ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS check_credit_limit;`,
    `ALTER TABLE "Customer" ADD CONSTRAINT check_credit_limit CHECK ("outstandingBalance" <= "creditLimit");`
  ];
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }
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
