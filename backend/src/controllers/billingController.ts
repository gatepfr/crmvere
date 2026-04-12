import { Request, Response } from 'express';
import { createCheckoutSession, createPortalSession } from '../services/stripeService';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';

export const startCheckout = async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId!;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  
  const session = await createCheckoutSession(tenantId, req.user!.email, process.env.STRIPE_PRICE_ID!);
  res.json({ url: session.url });
};

export const openPortal = async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId!;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  
  if (!tenant.stripeCustomerId) return res.status(400).json({ error: 'No stripe customer found' });
  
  const session = await createPortalSession(tenant.stripeCustomerId);
  res.json({ url: session.url });
};

export const getSubscriptionInfo = async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId!;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  res.json(tenant);
};
