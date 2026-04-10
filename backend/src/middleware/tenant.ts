import { Request, Response, NextFunction } from 'express';

export const checkTenant = (req: Request, res: Response, next: NextFunction) => {
  const userTenantId = req.user?.tenantId;
  
  // Super admin can access everything (no tenant context needed)
  if (!userTenantId && req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'No tenant context' });
    return;
  }
  
  next();
};
