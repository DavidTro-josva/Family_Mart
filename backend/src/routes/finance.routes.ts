import { Router } from 'express';
import { 
  openRegister, 
  closeRegister, 
  addRegisterTransaction, 
  getActiveRegister, 
  postCustomerPayment, 
  getCustomerLedger 
} from '../controllers/finance.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply JWT authentication to all finance routes
router.use(authenticateJWT as any);

// --- Cash Register ---
router.post('/register/open', openRegister as any);
router.post('/register/close', closeRegister as any);
router.post('/register/transaction', addRegisterTransaction as any);
router.get('/register/active', getActiveRegister as any);

// --- Customer Credit ---
router.post('/credit/pay', postCustomerPayment as any);
router.get('/credit/ledger/:customerId', getCustomerLedger);

export default router;
