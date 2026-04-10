import { Router } from 'express';
import { getMetrics } from '../controllers/metricsController';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';

const router = Router();

router.get('/', authenticate, checkTenant, getMetrics);

export default router;
