import { Router } from 'express';
import * as intelligenceController from '../controllers/intelligenceController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/summary', intelligenceController.getSummary);
router.post('/action/execute', intelligenceController.executePlan);

export default router;
