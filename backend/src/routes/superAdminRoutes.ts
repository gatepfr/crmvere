import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  createTenant, 
  listTenants, 
  deleteTenant, 
  updateTenant, 
  updateSubscriptionStatus, 
  getSystemStats, 
  listAllUsers, 
  resetUserPassword,
  resetDatabase,
  getGlobalConfig,
  updateGlobalConfig
} from '../controllers/superAdminController';

const router = Router();

const checkSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Access denied. Super Admin only.' });
    return;
  }
  next();
};

router.use(authenticate);
router.use(checkSuperAdmin);

// Global Config
router.get('/config', getGlobalConfig);
router.patch('/config', updateGlobalConfig);

router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
router.patch('/tenants/:id', updateTenant);
router.patch('/tenants/:id/subscription', updateSubscriptionStatus);
router.delete('/tenants/:id', deleteTenant);

router.get('/stats', getSystemStats);
router.get('/users', listAllUsers);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/reset-database', resetDatabase);

export default router;

