import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication to all dashboard routes
router.use(authenticateJWT as any);

router.get('/summary', getDashboardSummary as any);

export default router;
