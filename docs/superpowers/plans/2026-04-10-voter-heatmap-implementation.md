# Mapa de Calor de Demandas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an interactive Heatmap module using Leaflet to visualize demand density across neighborhoods for each cabinet.

**Architecture:** 
- **Backend:** Create `mapRoutes.ts` to aggregate demand counts by neighborhood and provide mock/cached coordinates for common city regions.
- **Frontend:** Install `leaflet` and `react-leaflet`. Implement the `VoterMap.tsx` page.
- **Data Integration:** Fetch demand density from the API and map it to heatmap points.

**Tech Stack:** React, Leaflet, react-leaflet, Lucide React, Express, Drizzle ORM.

---

### Task 1: Frontend - Map Infrastructure

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/index.html` (add Leaflet CSS)

- [ ] **Step 1: Install Leaflet dependencies**

Run: `cd frontend && npm install leaflet react-leaflet @types/leaflet`

- [ ] **Step 2: Add Leaflet CSS to `index.html`**

```html
<!-- frontend/index.html -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/index.html
git commit -m "chore: install leaflet and map infrastructure"
```

---

### Task 2: Backend - Map API

**Files:**
- Create: `backend/src/routes/mapRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Implement map statistics route**

```typescript
// backend/src/routes/mapRoutes.ts
import { Router } from 'express';
import { db } from '../db';
import { demandas, municipes } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/data', async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  // Aggregate demands by neighborhood
  const stats = await db.select({
    bairro: municipes.bairro,
    count: sql<number>`count(*)::int`
  })
  .from(demandas)
  .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
  .where(eq(demandas.tenantId, tenantId!))
  .groupBy(municipes.bairro);

  // Simple mock geocoding for now - in production use a real API
  const mockCoords: Record<string, [number, number]> = {
    'Centro': [-23.5505, -46.6333],
    'Zona Sul': [-23.6, -46.6],
    'Zona Norte': [-23.5, -46.6],
    'Bairro Exemplo': [-23.55, -46.65]
  };

  const heatmapPoints = stats.map(s => {
    const coords = mockCoords[s.bairro || ''] || [-23.55 + (Math.random() * 0.1), -46.63 + (Math.random() * 0.1)];
    return [...coords, s.count * 0.5]; // [lat, lng, intensity]
  });

  res.json(heatmapPoints);
});

export default router;
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts
import mapRoutes from './routes/mapRoutes';
app.use('/api/map', mapRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/mapRoutes.ts backend/src/app.ts
git commit -m "feat: add map data API for heatmap"
```

---

### Task 3: Frontend - Voter Map Page

**Files:**
- Create: `frontend/src/pages/Dashboard/VoterMap.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Implement the VoterMap component**

Build a full-page map using `react-leaflet`. Since `react-leaflet` doesn't have a built-in heatmap, we will use a simple "CircleMarker" approach for now or a custom heatmap layer if dependencies allow.

- [ ] **Step 2: Update Sidebar and Routes**

Add "Mapa de Demandas" to the Sidebar and define the route in `App.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard/VoterMap.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "ui: implement interactive map of demands"
```
