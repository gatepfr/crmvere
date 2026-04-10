# Auth API Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setup the Express backend server and implement the authentication login route.

**Architecture:** Express.js server with Controller-Route pattern. Drizzle ORM for database access. JWT for authentication.

**Tech Stack:** Node.js, Express, Drizzle ORM, Bcryptjs, Jsonwebtoken, Vitest, Supertest.

---

### Task 0: Setup Testing Environment

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install testing dependencies**

Run: `npm install --save-dev vitest supertest @types/supertest` (in `backend/` directory)

- [ ] **Step 2: Add test script to package.json**

```json
"scripts": {
  "test": "vitest run",
  "dev": "nodemon src/app.ts"
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json
git commit -m "chore: setup testing environment"
```

### Task 1: Auth Controller Login Logic

**Files:**
- Create: `backend/src/controllers/authController.ts`
- Test: `backend/src/controllers/__tests__/authController.test.ts`

- [ ] **Step 1: Write failing test for login logic**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login } from '../authController';
import { db } from '../../db';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

vi.mock('../../db');
vi.mock('bcryptjs');
vi.mock('jsonwebtoken');

describe('authController - login', () => {
  it('should return 401 if user not found', async () => {
    const req = { body: { email: 'notfound@example.com', password: 'password' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([])
      })
    });

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL (controller doesn't exist)

- [ ] **Step 3: Implement minimal login logic in authController.ts**

```typescript
import { Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const JWT_SECRET = process.env.JWT_SECRET || 'secret';

  const [user] = await db.select().from(users).where(eq(users.email, email));

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, tenantId: user.tenantId, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  return res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "feat: implement auth controller login logic"
```

### Task 2: Auth Routes

**Files:**
- Create: `backend/src/routes/authRoutes.ts`

- [ ] **Step 1: Create auth routes file**

```typescript
import { Router } from 'express';
import { login } from '../controllers/authController';

const router = Router();

router.post('/login', login);

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/authRoutes.ts
git commit -m "feat: define auth routes"
```

### Task 3: App Setup

**Files:**
- Create: `backend/src/app.ts`

- [ ] **Step 1: Setup Express app**

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: setup backend server"
```

### Task 4: Integration Test

**Files:**
- Test: `backend/src/__tests__/auth.integration.test.ts`

- [ ] **Step 1: Write integration test for /api/auth/login**

```typescript
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db';

vi.mock('../db');

describe('POST /api/auth/login', () => {
  it('should return 401 for invalid credentials', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([])
      })
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'password' });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd backend && npm test`
Expected: ALL PASS

- [ ] **Step 3: Final Commit**

```bash
git add backend/src/__tests__/auth.integration.test.ts
git commit -m "test: add auth integration tests"
```
