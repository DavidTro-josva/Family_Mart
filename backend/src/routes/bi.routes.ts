import { Router } from 'express';
import {
  getExecutiveKPIs,
  getSalesAnalytics,
  getInventoryIntelligence,
} from '../controllers/bi.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication and restrict to Admin & Manager roles for all BI endpoints
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER']) as any);

router.get('/kpis', getExecutiveKPIs as any);
router.get('/sales-analytics', getSalesAnalytics as any);
router.get('/inventory-intelligence', getInventoryIntelligence as any);

export default router;
