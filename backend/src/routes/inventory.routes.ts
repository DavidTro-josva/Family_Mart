import { Router } from 'express';
import { 
  getInventoryDashboard, 
  getTransactions, 
  adjustStock, 
  getWarehouses 
} from '../controllers/inventory.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication to all inventory routes
router.use(authenticateJWT as any);

router.get('/dashboard', getInventoryDashboard);
router.get('/transactions', getTransactions);
router.get('/warehouses', getWarehouses);

// Only Admin, Manager, or Inventory Clerk can adjust stock
router.post('/adjust', requireRoles(['ADMIN', 'MANAGER', 'INVENTORY_CLERK']) as any, adjustStock as any);

export default router;
