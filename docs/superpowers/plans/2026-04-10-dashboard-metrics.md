# Phase 5: Dashboard & Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a visual dashboard for councilors and staff to track demand metrics, trends, and gabinete productivity.

**Architecture:** 
- Backend: Specialized metrics controller that aggregates data using Drizzle ORM.
- Frontend: Dashboard page with statistic cards and interactive charts using `recharts`.

**Tech Stack:** Express, Drizzle ORM, React, Recharts, Lucide React.

---

### Task 1: Backend Metrics API

**Files:**
- Create: `backend/src/controllers/metricsController.ts`
- Create: `backend/src/routes/metricsRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Implement Metrics Controller with aggregations**

```typescript
// backend/src/controllers/metricsController.ts
import { Request, Response } from 'express';
import { db } from '../db';
import { demandas } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export const getMetrics = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Forbidden' });

  try {
    // 1. Total Demands
    const [totalDemands] = await db
      .select({ count: sql<number>`count(*)` })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId));

    // 2. Demands by Status
    const byStatus = await db
      .select({ status: demandas.status, count: sql<number>`count(*)` })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId))
      .groupBy(demandas.status);

    // 3. Demands by Category
    const byCategory = await db
      .select({ categoria: demandas.categoria, count: sql<number>`count(*)` })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId))
      .groupBy(demandas.categoria);

    res.json({
      total: totalDemands?.count || 0,
      byStatus,
      byCategory
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};
```

- [ ] **Step 2: Setup Metrics Routes**

```typescript
// backend/src/routes/metricsRoutes.ts
import { Router } from 'express';
import { getMetrics } from '../controllers/metricsController';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';

const router = Router();
router.use(authenticate, checkTenant);
router.get('/', getMetrics);
export default router;
```

- [ ] **Step 3: Register in app.ts**

```typescript
// backend/src/app.ts
import metricsRoutes from './routes/metricsRoutes';
// ...
app.use('/api/metrics', metricsRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat: implement backend metrics api"
```

---

### Task 2: Frontend Dashboard UI

**Files:**
- Create: `frontend/src/pages/Dashboard/DashboardHome.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install recharts lucide-react
```

- [ ] **Step 2: Implement Dashboard Page with Charts**

```tsx
// frontend/src/pages/Dashboard/DashboardHome.tsx
import { useEffect, useState } from 'react';
import api from '../../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Users, FileText, CheckCircle, Clock } from 'lucide-react';

export default function DashboardHome() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    api.get('/metrics').then(res => setMetrics(res.data));
  }, []);

  if (!metrics) return <div>Carregando métricas...</div>;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Dashboard do Gabinete</h1>
      
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><FileText size={24} /></div>
          <div><p className="text-sm text-gray-500">Total de Demandas</p><p className="text-2xl font-bold">{metrics.total}</p></div>
        </div>
        {/* Add more cards for specific statuses if needed */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories Bar Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Demandas por Categoria</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.byCategory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="categoria" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Distribuição por Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
                  {metrics.byStatus.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx Routing and simple Sidebar**

```tsx
// frontend/src/App.tsx (Update)
import DashboardHome from './pages/Dashboard/DashboardHome';
import { LayoutDashboard, ClipboardList, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 text-white p-6 flex flex-col">
        <h2 className="text-xl font-bold mb-8">VereadorCRM</h2>
        <nav className="space-y-4 flex-1">
          <Link to="/dashboard" className="flex items-center space-x-3 text-slate-300 hover:text-white transition-colors">
            <LayoutDashboard size={20} /><span>Dashboard</span>
          </Link>
          <Link to="/demands" className="flex items-center space-x-3 text-slate-300 hover:text-white transition-colors">
            <ClipboardList size={20} /><span>Demandas</span>
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

// ... update routes to use Layout ...
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: implement dashboard visualization with charts"
```
