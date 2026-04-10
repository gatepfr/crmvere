# Infrastructure & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the multi-tenant base, database schema with Drizzle, and authentication system with Super Admin capabilities.

**Architecture:** Monorepo with Express backend and React frontend. Data isolation using a global `tenant_id` filter. JWT-based authentication with roles.

**Tech Stack:** Node.js, Express, Drizzle ORM, PostgreSQL, React, TypeScript, Tailwind CSS.

---

### Task 1: Project Structure & Docker Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/schema.ts`

- [ ] **Step 1: Create docker-compose.yml with PostgreSQL and Redis**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: vereador_crm
    ports:
      - "5432:5432"
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

- [ ] **Step 2: Define initial Drizzle schema with multi-tenancy**

```typescript
import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['super_admin', 'admin', 'vereador', 'assessor']);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').default('assessor'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

- [ ] **Step 3: Run docker-compose and verify DB connection**

Run: `docker-compose up -d`
Run: `npx drizzle-kit push` (inside backend)
Expected: Tables created in PostgreSQL.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "infra: setup docker and initial drizzle schema"
```

---

### Task 2: Auth Middleware & Tenant Isolation

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/middleware/tenant.ts`

- [ ] **Step 1: Write auth middleware with JWT verification**

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

- [ ] **Step 2: Write tenant isolation middleware**

```typescript
export const checkTenant = (req: Request, res: Response, next: NextFunction) => {
  const userTenantId = req.user?.tenantId;
  if (!userTenantId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'No tenant context' });
  }
  next();
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/middleware
git commit -m "feat: add auth and tenant isolation middleware"
```

---

### Task 3: Super Admin API & Initial Seed

**Files:**
- Create: `backend/src/routes/superadmin.ts`
- Create: `backend/src/scripts/seed.ts`

- [ ] **Step 1: Create seed script for Super Admin**

```typescript
// backend/src/scripts/seed.ts
import { db } from '../db';
import { users } from '../db/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  const hash = await bcrypt.hash('admin123', 12);
  await db.insert(users).values({
    email: 'super@admin.com',
    passwordHash: hash,
    role: 'super_admin'
  });
  console.log('Super Admin created');
}
seed();
```

- [ ] **Step 2: Run seed and verify**

Run: `npx tsx src/scripts/seed.ts`
Expected: "Super Admin created" in terminal.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts
git commit -m "feat: add super admin seed script"
```
