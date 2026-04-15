import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';

export const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
  const userRole = req.user?.role;
  if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'vereador') return next();
  
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Assinatura não identificada.' });

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const now = new Date();
  const status = tenant.subscriptionStatus || 'trial';
  const trialEndsAt = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (status === 'lifetime' || status === 'active') {
    return next();
  }

  if (status === 'trial') {
    if (now > trialEndsAt) {
      return res.status(402).json({ error: 'Trial expired', status: 'trial_expired' });
    }
    return next();
  }

  if (status === 'past_due') {
    const graceEndsAt = tenant.gracePeriodEndsAt ? new Date(tenant.gracePeriodEndsAt) : null;
    if (graceEndsAt && now > graceEndsAt) {
      return res.status(402).json({ error: 'Subscription unpaid', status: 'unpaid' });
    }
    return next();
  }

  if (status === 'unpaid') {
    return res.status(402).json({ error: 'Subscription unpaid', status: 'unpaid' });
  }

  next();
};
