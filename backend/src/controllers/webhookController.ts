import { Request, Response } from 'express';
import stripe from '../services/stripeService';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature']!;
  let event;

  try {
    // Note: req.body MUST be the raw buffer for signature verification
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error(`[STRIPE WEBHOOK ERROR] ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Event type: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const tenantId = session.client_reference_id;
      if (tenantId) {
        await db.update(tenants)
          .set({
            subscriptionStatus: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          })
          .where(eq(tenants.id, tenantId));
      }
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as any;
      await db.update(tenants)
        .set({ subscriptionStatus: 'active' })
        .where(eq(tenants.stripeCustomerId, invoice.customer));
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as any;
      const gracePeriodEndsAt = new Date();
      gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 5);
      
      await db.update(tenants)
        .set({
          subscriptionStatus: 'past_due',
          gracePeriodEndsAt: gracePeriodEndsAt
        })
        .where(eq(tenants.stripeCustomerId, invoice.customer));
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;
      await db.update(tenants)
        .set({ subscriptionStatus: 'unpaid' })
        .where(eq(tenants.stripeSubscriptionId, subscription.id));
      break;
    }
  }

  res.json({ received: true });
};
