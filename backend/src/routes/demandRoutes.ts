import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDemands } from '../controllers/demandController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDemands);

export default router;
