import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDemands, getDemand, updateStatus, updateMunicipe, deleteMunicipe } from '../controllers/demandController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDemands);
router.get('/:id', getDemand);
router.patch('/:id/status', updateStatus);
router.patch('/municipe/:id', updateMunicipe);
router.delete('/municipe/:id', deleteMunicipe);

export default router;
