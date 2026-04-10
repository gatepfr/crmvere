import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDemands, getDemand, updateStatus } from '../controllers/demandController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDemands);
router.get('/:id', getDemand);
router.patch('/:id/status', updateStatus);

export default router;
