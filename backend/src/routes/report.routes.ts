import { Router } from 'express';
import {
  getSalesReport,
  getInventoryReport,
  getTaxReport,
  getFinancialReport,
} from '../controllers/report.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication and restrict to Admin & Manager roles for all report endpoints
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER']) as any);

router.get('/sales', getSalesReport as any);
router.get('/inventory', getInventoryReport as any);
router.get('/tax', getTaxReport as any);
router.get('/financial', getFinancialReport as any);

export default router;
