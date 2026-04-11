# Dashboard com Gráficos Reais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static data with real database metrics and implement visual charts (Line & Pie) using Recharts to provide a professional overview of cabinet demands.

**Architecture:** 
- **Backend:** Refactor `metricsController.ts` to perform real SQL aggregations (count by category, count by date) scoped to the tenant.
- **Frontend:** Update `DashboardHome.tsx` to fetch real data from the API and render dynamic charts.
- **Styling:** Maintain "Inter + Slate" theme with polished chart tooltips and colors.

**Tech Stack:** Node.js, Drizzle ORM (SQL aggregations), React, Recharts, Lucide React.

---

### Task 1: Backend - Real Metrics API

**Files:**
- Modify: `backend/src/controllers/metricsController.ts`

- [ ] **Step 1: Implement real SQL aggregations**

```typescript
// backend/src/controllers/metricsController.ts
import { db } from '../db';
import { demandas } from '../db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export const getDashboardStats = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  
  // 1. Total demands and pending count
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(demandas).where(eq(demandas.tenantId, tenantId!));
  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(demandas).where(sql`${demandas.tenantId} = ${tenantId} AND ${demandas.status} = 'nova'`);

  // 2. Count by Category (for Pie Chart)
  const categoryStats = await db.select({
    name: demandas.categoria,
    value: sql<number>`count(*)`
  })
  .from(demandas)
  .where(eq(demandas.tenantId, tenantId!))
  .groupBy(demandas.categoria);

  // 3. Demands over last 7 days (for Line Chart)
  const last7Days = await db.select({
    date: sql<string>`TO_CHAR(${demandas.createdAt}, 'DD/MM')`,
    count: sql<number>`count(*)`
  })
  .from(demandas)
  .where(eq(demandas.tenantId, tenantId!))
  .groupBy(sql`TO_CHAR(${demandas.createdAt}, 'DD/MM')`)
  .orderBy(desc(sql`TO_CHAR(${demandas.createdAt}, 'DD/MM')`))
  .limit(7);

  res.json({
    summary: { total: Number(total?.count || 0), pending: Number(pending?.count || 0) },
    categoryStats,
    dailyStats: last7Days.reverse()
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/metricsController.ts
git commit -m "feat: implement real sql aggregations for dashboard metrics"
```

---

### Task 2: Frontend - Charts Integration

**Files:**
- Modify: `frontend/src/pages/Dashboard/DashboardHome.tsx`

- [ ] **Step 1: Fetch and render real data**

Connect `DashboardHome.tsx` to `/api/metrics` and map the response to `Recharts` components.

- [ ] **Step 2: Polish Chart UI**

Add custom tooltips, consistent colors (Slate/Blue/Indigo), and responsive containers.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard/DashboardHome.tsx
git commit -m "ui: implement dynamic charts with real data in dashboard"
```
