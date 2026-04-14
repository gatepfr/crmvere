# Stripe Webhook Handler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Stripe webhook handler to manage tenant subscription statuses (active, past_due, unpaid).

**Architecture:** Create a new Stripe webhook controller, integrate it into the existing webhook routes with raw body parsing support, and adjust the main app middleware order to ensure signature verification works.

**Tech Stack:** Express, Stripe SDK, Drizzle ORM, PostgreSQL.

---

### Task 1: Create Stripe Webhook Controller

**Files:**
- Create: `backend/src/controllers/webhookController.ts`

- [ ] **Step 1: Create the controller file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/webhookController.ts
git commit -m "feat: add Stripe webhook controller"
```

### Task 2: Integrate Stripe Webhook into Routes

**Files:**
- Modify: `backend/src/routes/webhookRoutes.ts`

- [ ] **Step 1: Add Stripe route and update existing ones**
We need to ensure that the Stripe route uses `express.raw` while the Evolution route uses `express.json` if we move `webhookRoutes` before the global `express.json()` in `app.ts`.

```typescript
import { Router, Request, Response } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
// ... other imports
```

Update `backend/src/routes/webhookRoutes.ts` to:
1. Add `import { handleStripeWebhook } from '../controllers/webhookController';`
2. Add `router.post('/stripe', express.raw({type: 'application/json'}), handleStripeWebhook);`
3. Ensure the Evolution route uses `express.json()` middleware explicitly since we'll move this router before global JSON middleware.

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/webhookRoutes.ts
git commit -m "feat: integrate Stripe webhook route"
```

### Task 3: Adjust App Middleware Order

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Move webhook route before express.json()**

Move:
```typescript
app.use('/api/webhook', webhookRoutes);
```
To be BEFORE:
```typescript
app.use(express.json());
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/app.ts
git commit -m "fix: move webhook routes before global json middleware for stripe raw body parsing"
```

### Task 4: Verification

- [ ] **Step 1: Verify existing tests pass**

Run: `npm test backend/src/__tests__/webhookRoutes.test.ts` (adjust command as needed)

- [ ] **Step 2: (Optional) Create a test for Stripe webhook**
Create `backend/src/__tests__/stripeWebhook.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/stripeWebhook.test.ts
git commit -m "test: add stripe webhook verification test"
```
