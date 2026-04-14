# Database Migration - Update Tenants Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the `tenants` table in the database schema to include subscription-related columns and run the migration.

**Architecture:** Use Drizzle ORM to define the schema changes and Drizzle Kit to generate and push the migration to the PostgreSQL database.

**Tech Stack:** TypeScript, Drizzle ORM, Drizzle Kit, PostgreSQL.

---

### Task 1: Update Schema Definition

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Update imports and define Subscription Status Enum**

Add `sql` to imports and define `subscriptionStatusEnum`.

```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum, boolean, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["super_admin", "admin", "vereador", "assessor"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["trial", "active", "past_due", "unpaid", "lifetime"]);
```

- [ ] **Step 2: Add subscription columns to tenants table**

Add the following columns to the `tenants` table definition:
- `subscriptionStatus`: `subscriptionStatusEnum("subscription_status").default("trial").notNull()`
- `trialEndsAt`: `timestamp("trial_ends_at").default(sql`CURRENT_TIMESTAMP + interval '7 days'`).notNull()`
- `gracePeriodEndsAt`: `timestamp("grace_period_ends_at")`
- `stripeCustomerId`: `varchar("stripe_customer_id", { length: 255 })`
- `stripeSubscriptionId`: `varchar("stripe_subscription_id", { length: 255 })`
- `isManual`: `boolean("is_manual").default(false).notNull()`
- `monthlyPrice`: `integer("monthly_price").default(24700).notNull()`

### Task 2: Run Database Migration

- [ ] **Step 1: Generate and push migration**

Run the following commands in the terminal:
```bash
cd backend && npx drizzle-kit generate:pg && npx drizzle-kit push:pg
```

### Task 3: Commit Changes

- [ ] **Step 1: Commit the schema changes and migration files**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "feat: update tenants table with subscription columns"
```
