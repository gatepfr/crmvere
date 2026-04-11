# Gestão de Equipe e Perfil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement team management for cabinets (adding assessors with default password) and a profile page for users to change their own passwords.

**Architecture:** 
- **Backend:** Create `teamRoutes.ts` for managing users within the same tenant and `profileRoutes.ts` for self-service password updates.
- **Frontend:** Implement `Team.tsx` and `Profile.tsx` pages. Update the Sidebar to include these links and handle role-based visibility.
- **Security:** Ensure users can only list/manage members of their own `tenantId`.

**Tech Stack:** Node.js, Express, Drizzle ORM, bcryptjs, React, Tailwind CSS.

---

### Task 1: Backend - Team Management API

**Files:**
- Create: `backend/src/routes/teamRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create team management routes**

```typescript
// backend/src/routes/teamRoutes.ts
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// GET /api/team - List members of the cabinet
router.get('/', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const members = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt
  }).from(users).where(eq(users.tenantId, tenantId));
  
  res.json(members);
});

// POST /api/team - Add new assessor
router.post('/', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { email } = req.body;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (req.user?.role === 'assessor') return res.status(403).json({ error: 'Only admins can add members' });

  const passwordHash = await bcrypt.hash('assessor123', 12);
  
  try {
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      role: 'assessor',
      tenantId
    }).returning();
    res.status(201).json(newUser);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'User already exists' });
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/team/:id - Remove member
router.delete('/:id', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  
  if (id === req.user?.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  await db.delete(users).where(and(eq(users.id, id), eq(users.tenantId, tenantId!)));
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts
import teamRoutes from './routes/teamRoutes';
// ...
app.use('/api/team', teamRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/teamRoutes.ts backend/src/app.ts
git commit -m "feat: add team management API routes"
```

---

### Task 2: Backend - Profile API (Password Update)

**Files:**
- Create: `backend/src/routes/profileRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create profile routes**

```typescript
// backend/src/routes/profileRoutes.ts
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

router.patch('/password', async (req, res) => {
  const userId = req.user?.id;
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId!));
  
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts
import profileRoutes from './routes/profileRoutes';
// ...
app.use('/api/profile', profileRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/profileRoutes.ts backend/src/app.ts
git commit -m "feat: add user profile API routes for password update"
```

---

### Task 3: Frontend - Team and Profile Pages

**Files:**
- Create: `frontend/src/pages/Dashboard/Team.tsx`
- Create: `frontend/src/pages/Dashboard/Profile.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Implement Team page**

```tsx
// frontend/src/pages/Dashboard/Team.tsx
// Features: List members in a table, Add member modal/form, Delete member
```

- [ ] **Step 2: Implement Profile page**

```tsx
// frontend/src/pages/Dashboard/Profile.tsx
// Features: Change password form
```

- [ ] **Step 3: Update Sidebar and Routes**

```tsx
// Update Sidebar.tsx to include "Equipe" (only for admins) and "Meu Perfil"
// Update App.tsx to include routes for /dashboard/team and /dashboard/profile
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard/Team.tsx frontend/src/pages/Dashboard/Profile.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "ui: implement Team and Profile pages with role-based navigation"
```
