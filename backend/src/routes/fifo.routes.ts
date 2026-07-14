import { Router } from 'express';
import {
  getValuation,
  getLayers,
  getConsumptions,
} from '../controllers/fifo.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply authentication and role guards
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER']) as any);

router.get('/valuation', getValuation as any);
router.get('/layers', getLayers as any);
router.get('/consumptions', getConsumptions as any);

export default router;
