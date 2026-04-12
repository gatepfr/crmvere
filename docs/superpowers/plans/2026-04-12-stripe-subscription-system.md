# Stripe Subscription System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete Stripe-based subscription and access control system with Trial, Grace Period, and SuperAdmin manual overrides.

**Architecture:** Use Stripe Checkout for payments and Webhooks for real-time synchronization. Access control is enforced via backend middleware checking the `subscription_status` on the `tenants` table.

**Tech Stack:** Node.js, Express, Drizzle ORM, Stripe API, React.

---

### Task 1: Database Migration - Update Tenants Table

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Define Subscription Status Enum**

```typescript
export const subscriptionStatusEnum = pgEnum("subscription_status", ["trial", "active", "past_due", "unpaid", "lifetime"]);
```

- [ ] **Step 2: Update Tenants Table Definition**

Add the following columns to `tenants` table in `backend/src/db/schema.ts`:
- `subscriptionStatus`: `subscriptionStatusEnum("subscription_status").default("trial").notNull()`
- `trialEndsAt`: `timestamp("trial_ends_at").default(sql`CURRENT_TIMESTAMP + interval '7 days'`).notNull()`
- `gracePeriodEndsAt`: `timestamp("grace_period_ends_at")`
- `stripeCustomerId`: `varchar("stripe_customer_id", { length: 255 })`
- `stripeSubscriptionId`: `varchar("stripe_subscription_id", { length: 255 })`
- `isManual`: `boolean("is_manual").default(false).notNull()`
- `monthlyPrice`: `integer("monthly_price").default(24700).notNull()`

- [ ] **Step 3: Run Database Migration**

Run: `cd backend && npx drizzle-kit generate:pg && npx drizzle-kit push:pg` (or equivalent migration command for the project)
Expected: Database schema updated with new columns.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: add subscription fields to tenants table"
```

---

### Task 2: Stripe Service and Backend Configuration

**Files:**
- Create: `backend/src/services/stripeService.ts`
- Modify: `backend/.env` (Manual step for user)

- [ ] **Step 1: Create Stripe Service**

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export const createCheckoutSession = async (tenantId: string, customerEmail: string, priceId: string) => {
  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
    customer_email: customerEmail,
    client_reference_id: tenantId,
    metadata: { tenantId },
  });
};

export const createPortalSession = async (stripeCustomerId: string) => {
  return await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/billing`,
  });
};

export default stripe;
```

- [ ] **Step 2: Add Stripe Keys to .env**

Instruct user to add:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/stripeService.ts
git commit -m "feat: add stripe service"
```

---

### Task 3: Access Control Middleware

**Files:**
- Create: `backend/src/middleware/subscription.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create Subscription Middleware**

```typescript
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
```

- [ ] **Step 2: Register Middleware in Routes**

Apply `checkSubscription` to all protected routes except billing and auth.

- [ ] **Step 3: Commit**

```bash
git add backend/src/middleware/subscription.ts
git commit -m "feat: add subscription check middleware"
```

---

### Task 4: Billing Controller and Routes

**Files:**
- Create: `backend/src/controllers/billingController.ts`
- Create: `backend/src/routes/billingRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create Billing Controller**

```typescript
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
```

- [ ] **Step 2: Create Billing Routes**

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { startCheckout, openPortal, getSubscriptionInfo } from '../controllers/billingController';

const router = Router();
router.get('/info', authenticateToken, getSubscriptionInfo);
router.post('/checkout', authenticateToken, startCheckout);
router.post('/portal', authenticateToken, openPortal);

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/billingController.ts backend/src/routes/billingRoutes.ts
git commit -m "feat: add billing routes and controller"
```

---

### Task 5: Stripe Webhook Handler

**Files:**
- Create: `backend/src/controllers/webhookController.ts`
- Create: `backend/src/routes/webhookRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create Webhook Controller**

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
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const tenantId = session.client_reference_id;
      await db.update(tenants)
        .set({
          subscriptionStatus: 'active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        })
        .where(eq(tenants.id, tenantId));
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

- [ ] **Step 2: Configure Raw Body in App.ts**

Important: Webhook route needs `express.raw({type: 'application/json'})`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/webhookController.ts backend/src/routes/webhookRoutes.ts
git commit -m "feat: add stripe webhook handler"
```

---

### Task 6: Frontend Access Control UI

**Files:**
- Create: `frontend/src/components/SubscriptionGuard.tsx`
- Create: `frontend/src/components/BillingBanner.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Subscription Guard**

Component that checks for 402 errors and blocks the screen.

- [ ] **Step 2: Create Billing Banner**

Shows "Trial ends in X days" or "Payment overdue, 3 days left".

- [ ] **Step 3: Create Billing Management Page**

Buttons for "Subscribe" or "Manage Subscription".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SubscriptionGuard.tsx frontend/src/components/BillingBanner.tsx
git commit -m "feat: add frontend subscription UI components"
```

---

### Task 7: SuperAdmin Management UI

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts`
- Modify: `frontend/src/pages/SuperAdminTenants.tsx`

- [ ] **Step 1: Add Manual Override Actions in Backend**

Add `updateSubscriptionStatus` endpoint.

- [ ] **Step 2: Add Controls in SuperAdmin UI**

Buttons: "Set Lifetime", "Extend Trial", "Deactivate".

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat: add superadmin subscription overrides"
```
