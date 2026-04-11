# Funil de Leads Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a multi-campaign Kanban board system for managing leads with drag-and-drop functionality.

**Architecture:** 
- **Database:** Create `campaigns`, `campaign_columns`, and `leads` tables with proper relationships.
- **Backend:** Implement a REST API for CRUD operations on campaigns and for moving leads between columns.
- **Frontend:** Use `@dnd-kit` for a high-performance drag-and-drop experience. Create a board view that filters by campaign.

**Tech Stack:** Node.js, Drizzle ORM, React, @dnd-kit/core, @dnd-kit/sortable, Tailwind CSS.

---

### Task 1: Database Schema Expansion

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add Kanban-related tables**

```typescript
// backend/src/db/schema.ts

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignColumns = pgTable("campaign_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  order: integer("order").notNull().default(0),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  columnId: uuid("column_id").references(() => campaignColumns.id, { onDelete: "cascade" }).notNull(),
  municipeId: uuid("municipe_id").references(() => municipes.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  notes: varchar("notes", { length: 1000 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Generate and push migration**

Run: `cd backend; npx drizzle-kit push`
Expected: Database updated with 3 new tables.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: add tables for campaigns, columns and leads"
```

---

### Task 2: Backend - Kanban API

**Files:**
- Create: `backend/src/routes/kanbanRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Implement Kanban management routes**

```typescript
// backend/src/routes/kanbanRoutes.ts
// Endpoints:
// GET /api/kanban/campaigns - List campaigns
// POST /api/kanban/campaigns - Create campaign + default columns
// GET /api/kanban/boards/:campaignId - Get columns and leads
// PATCH /api/kanban/leads/:id/move - Move lead to different column
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts
import kanbanRoutes from './routes/kanbanRoutes';
app.use('/api/kanban', kanbanRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/kanbanRoutes.ts backend/src/app.ts
git commit -m "feat: implement kanban and campaign backend API"
```

---

### Task 3: Frontend - Kanban Board UI

**Files:**
- Create: `frontend/src/pages/Dashboard/KanbanLeads.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Install dnd-kit**

Run: `cd frontend; npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Implement the Kanban Board component**

Create a modern board with:
- Horizontal scrolling columns.
- Draggable cards.
- Campaign selector dropdown.
- Add Lead / Add Column modals.

- [ ] **Step 3: Update Sidebar and Routes**

Add "Funil de Leads" to Sidebar and register the route.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard/KanbanLeads.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "ui: implement interactive kanban board for leads"
```
