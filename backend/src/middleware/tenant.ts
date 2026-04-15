import { Request, Response, NextFunction } from 'express';

export const checkTenant = (req: Request, res: Response, next: NextFunction) => {
  const userTenantId = req.user?.tenantId;
  const userRole = req.user?.role;
  
  // Super admin, admin and vereador can bypass strict missing tenant check for recovery
  if (!userTenantId && userRole !== 'super_admin' && userRole !== 'admin' && userRole !== 'vereador') {
    console.error(`[TENANT ERROR] Access denied for user ${req.user?.id} (Role: ${userRole}) - No tenant context`);
    res.status(403).json({ error: 'Contexto de gabinete não encontrado. Contate o suporte.' });
    return;
  }
  
  next();
};
