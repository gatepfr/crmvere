import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDemands, getDemand, updateDemand, updateMunicipe, deleteMunicipe, createDemand } from '../controllers/demandController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDemands);
router.post('/', createDemand);
router.get('/:id', getDemand);
router.patch('/:id/status', updateDemand);
router.patch('/municipe/:id', updateMunicipe);
router.delete('/municipe/:id', deleteMunicipe);

export default router;
