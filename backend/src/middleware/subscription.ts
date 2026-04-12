import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';

export const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === 'super_admin') return next();
  
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const now = new Date();

  if (tenant.subscriptionStatus === 'lifetime' || tenant.subscriptionStatus === 'active') {
    return next();
  }

  if (tenant.subscriptionStatus === 'trial') {
    if (now > tenant.trialEndsAt) {
      return res.status(402).json({ error: 'Trial expired', status: 'trial_expired' });
    }
    return next();
  }

  if (tenant.subscriptionStatus === 'past_due') {
    if (tenant.gracePeriodEndsAt && now > tenant.gracePeriodEndsAt) {
      return res.status(402).json({ error: 'Subscription unpaid', status: 'unpaid' });
    }
    // Allow access but frontend should show warning
    return next();
  }

  if (tenant.subscriptionStatus === 'unpaid') {
    return res.status(402).json({ error: 'Subscription unpaid', status: 'unpaid' });
  }

  next();
};
