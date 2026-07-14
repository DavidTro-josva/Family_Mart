import { Router } from 'express';
import { getAuditLogs, getEventTypes } from '../controllers/audit.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication and role-based guard to all audit routes
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER']) as any);

router.get('/logs', getAuditLogs as any);
router.get('/types', getEventTypes as any);

export default router;
