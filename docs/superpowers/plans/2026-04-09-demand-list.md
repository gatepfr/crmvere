# Demand List API & Frontend Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an API to list demands for a tenant and a frontend table to display them, following the existing patterns in the project.

**Architecture:**
- Backend: `demandController` handles listing, `demandRoutes` registers the route.
- Join `demandas` and `municipes` using Drizzle ORM.
- Frontend: `Demands` component fetches data using `axios` (via `api/client.ts`) and displays in a Tailwind CSS table.
- App Routing: Replace the dashboard placeholder with the `Demands` component.

**Tech Stack:**
- Backend: Express, Drizzle ORM, Vitest (tests).
- Frontend: React, Tailwind CSS, React Router.

---

### Task 1: Backend Demand Controller & Tests

**Files:**
- Create: `backend/src/controllers/demandController.ts`
- Create: `backend/src/__tests__/demandController.test.ts`

- [ ] **Step 1: Write the failing test for `listDemands`**

```typescript
// backend/src/__tests__/demandController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('GET /api/demands', () => {
  const mockToken = jwt.sign({ id: 'u1', tenantId: 't1', role: 'admin' }, process.env.JWT_SECRET || 'test-secret');

  it('should list demands for the user tenant', async () => {
    // Mock the db.select() chain
    const mockDemands = [
      {
        demandas: { id: 'd1', categoria: 'Saúde', status: 'nova', prioridade: 'Alta', createdAt: new Date() },
        municipes: { name: 'João' }
      }
    ];

    const { db } = await import('../db');
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDemands)
    });

    const response = await request(app)
      .get('/api/demands')
      .set('Authorization', `Bearer ${mockToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].municipes.name).toBe('João');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test backend/src/__tests__/demandController.test.ts`
Expected: FAIL (404 Not Found since route is not registered, or module not found)

- [ ] **Step 3: Implement `demandController.ts`**

```typescript
// backend/src/controllers/demandController.ts
import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export const listDemands = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    res.status(403).json({ error: 'No tenant context' });
    return;
  }

  try {
    const results = await db
      .select({
        demandas: demandas,
        municipes: municipes
      })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(eq(demandas.tenantId, tenantId))
      .orderBy(desc(demandas.createdAt));

    res.status(200).json(results);
  } catch (error) {
    console.error('Error listing demands:', error);
    res.status(500).json({ error: 'Failed to list demands' });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test backend/src/__tests__/demandController.test.ts`
Wait, it will still fail with 404 until routes are registered. But I'll do that in Task 2.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/demandController.ts backend/src/__tests__/demandController.test.ts
git commit -m "feat: implement demand list controller and tests"
```

---

### Task 2: Backend Routes & Registration

**Files:**
- Create: `backend/src/routes/demandRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create `demandRoutes.ts`**

```typescript
// backend/src/routes/demandRoutes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDemands } from '../controllers/demandController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDemands);

export default router;
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts (add imports and app.use)
import demandRoutes from './routes/demandRoutes';
// ...
app.use('/api/demands', demandRoutes);
```

- [ ] **Step 3: Run the tests from Task 1 again**

Run: `npm run test backend/src/__tests__/demandController.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/demandRoutes.ts backend/src/app.ts
git commit -m "feat: register demand routes"
```

---

### Task 3: Frontend Demands Page

**Files:**
- Create: `frontend/src/pages/Dashboard/Demands.tsx`

- [ ] **Step 1: Implement `Demands.tsx`**

```tsx
// frontend/src/pages/Dashboard/Demands.tsx
import { useEffect, useState } from 'react';
import api from '../../api/client';

interface Demand {
  demandas: {
    id: string;
    categoria: string;
    status: string;
    prioridade: string;
    createdAt: string;
  };
  municipes: {
    name: string;
  };
}

export default function Demands() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/demands')
      .then(res => setDemands(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Carregando demandas...</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Demandas do Gabinete</h1>
        <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
          {demands.length} {demands.length === 1 ? 'demanda' : 'demandas'}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Munícipe
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categoria
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prioridade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {demands.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  Nenhuma demanda encontrada.
                </td>
              </tr>
            ) : (
              demands.map((demand) => (
                <tr key={demand.demandas.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {demand.municipes.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {demand.demandas.categoria}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      demand.demandas.status === 'nova' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      demand.demandas.status === 'em_andamento' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      demand.demandas.status === 'concluida' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {demand.demandas.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      demand.demandas.prioridade.toLowerCase() === 'alta' ? 'bg-red-50 text-red-700' :
                      demand.demandas.prioridade.toLowerCase() === 'media' ? 'bg-orange-50 text-orange-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {demand.demandas.prioridade}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(demand.demandas.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/Demands.tsx
git commit -m "feat: implement demands page"
```

---

### Task 4: Update App Routing

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update routing in `App.tsx`**

Replace the current `/dashboard` route with the `Demands` component.

```tsx
// frontend/src/App.tsx
import Demands from './pages/Dashboard/Demands';
// ...
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Demands />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add dashboard demands route"
```

---

### Final Validation

- [ ] **Step 1: Final verification of all changes**

Run: `npm run test` in backend.
Check if frontend compiles (e.g., `npm run build` in frontend, but I'll skip it if not requested, just check for errors).

- [ ] **Step 2: Final Commit (if any leftovers)**

```bash
git add .
git commit -m "feat: implement demand list API and frontend table"
```
