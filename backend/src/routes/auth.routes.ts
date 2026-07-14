import { Router } from 'express';
import { 
  login, 
  refresh, 
  logout, 
  forgotPassword, 
  resetPassword, 
  changePassword, 
  verifyPin, 
  me 
} from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticateJWT as any, me as any);
router.post('/change-password', authenticateJWT as any, changePassword as any);
router.post('/verify-pin', authenticateJWT as any, verifyPin as any);

export default router;
