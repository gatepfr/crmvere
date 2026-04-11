import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { createTenant, listTenants, deleteTenant, updateTenant, getSystemStats, listAllUsers } from '../controllers/superAdminController';

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

router.post('/tenants', createTenant);
router.get('/tenants', listTenants);
router.patch('/tenants/:id', updateTenant);
router.delete('/tenants/:id', deleteTenant);

router.get('/stats', getSystemStats);
router.get('/users', listAllUsers);

export default router;
