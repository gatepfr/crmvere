import { Router } from 'express';
import { getDashboardStats } from '../controllers/metricsController';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';

const router = Router();

router.get('/', authenticate, checkTenant, getDashboardStats);

export default router;
