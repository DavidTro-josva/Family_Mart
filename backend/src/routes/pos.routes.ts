import { Router } from 'express';
import { checkout, getInvoices } from '../controllers/pos.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication to all POS routes
router.use(authenticateJWT as any);

router.post('/checkout', checkout as any);
router.get('/invoices', getInvoices);

export default router;
