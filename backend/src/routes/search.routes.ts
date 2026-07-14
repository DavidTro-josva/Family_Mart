import { Router } from 'express';
import {
  getUniversalSearch,
  getEventTimeline,
} from '../controllers/search.controller.js';
import { authenticateJWT, requireRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication and restrict to Admin & Manager roles for all search/explorer endpoints
router.use(authenticateJWT as any);
router.use(requireRoles(['ADMIN', 'MANAGER']) as any);

router.get('/', getUniversalSearch as any);
router.get('/timeline', getEventTimeline as any);

export default router;
