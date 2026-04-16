import { Request, Response, NextFunction } from 'express';

export const checkTenant = (req: Request, res: Response, next: NextFunction) => {
  const userTenantId = req.user?.tenantId;
  
  if (!userTenantId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'TENANT_NOT_FOUND', message: 'Nenhum gabinete associado a este usuário.' });
  }
  
  next();
};
