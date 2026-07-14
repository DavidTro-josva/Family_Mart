import { Router } from 'express';
import {
  getAlerts,
  dismissAlert,
} from '../controllers/alert.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication and restrict to Admin & Manager roles for all alert endpoints
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER']) as any);

router.get('/', getAlerts as any);
router.post('/:alertId/dismiss', dismissAlert as any);

export default router;
