-- 1. Automated Stock Audit Trail Function & Trigger
CREATE OR REPLACE FUNCTION log_stock_change()
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_stock_update ON "WarehouseStock";

CREATE TRIGGER after_stock_update
AFTER UPDATE ON "WarehouseStock"
FOR EACH ROW
EXECUTE FUNCTION log_stock_change();

-- 2. Customer Credit Limit Check Constraint
ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS check_credit_limit;
ALTER TABLE "Customer" ADD CONSTRAINT check_credit_limit CHECK ("outstandingBalance" <= "creditLimit");
