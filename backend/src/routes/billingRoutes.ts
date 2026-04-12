import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { startCheckout, openPortal, getSubscriptionInfo } from '../controllers/billingController';

const router = Router();
router.get('/info', authenticate, getSubscriptionInfo);
router.post('/checkout', authenticate, startCheckout);
router.post('/portal', authenticate, openPortal);

export default router;
