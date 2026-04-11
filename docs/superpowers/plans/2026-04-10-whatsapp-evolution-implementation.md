# Integração Evolution API (WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full WhatsApp integration via Evolution API, including automated instance management, QR code display, and webhook processing for incoming messages.

**Architecture:** 
- **Backend Service:** Create `whatsappService.ts` to handle all communication with the Evolution API.
- **Backend Routes:** Add `/api/whatsapp` endpoints for instance creation, QR code retrieval, and status checking.
- **Webhook Integration:** Refine `/api/webhook/evolution/:tenantId` to correctly parse messages and trigger AI processing.
- **Frontend UI:** Build the `WhatsAppConfig.tsx` page with real-time status updates and QR code polling.

**Tech Stack:** Node.js, Express, Axios (for API calls), React, Lucide React.

---

### Task 1: Database Schema Refinement

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add Evolution API URL and Global Token to `tenants` table**

```typescript
// backend/src/db/schema.ts
export const tenants = pgTable("tenants", {
  // ... existing fields
  evolutionApiUrl: varchar("evolution_api_url", { length: 255 }),
  evolutionGlobalToken: varchar("evolution_global_token", { length: 255 }),
  // ...
});
```

- [ ] **Step 2: Push database changes**

Run: `cd backend && npx drizzle-kit push`
Expected: Table `tenants` updated with new columns.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: add evolution api credentials to tenants table"
```

---

### Task 2: Backend - Evolution API Service

**Files:**
- Create: `backend/src/services/evolutionService.ts`

- [ ] **Step 1: Implement the Evolution API client service**

```typescript
// backend/src/services/evolutionService.ts
import axios from 'axios';

export class EvolutionService {
  constructor(private baseUrl: string, private globalToken: string) {}

  async createInstance(instanceName: string) {
    const response = await axios.post(`${this.baseUrl}/instance/create`, {
      instanceName,
      token: Math.random().toString(36).substring(7), // Random instance token
      qrcode: true
    }, { headers: { apikey: this.globalToken } });
    return response.data;
  }

  async getQrCode(instanceName: string) {
    const response = await axios.get(`${this.baseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: this.globalToken }
    });
    return response.data;
  }

  async getStatus(instanceName: string) {
    const response = await axios.get(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: this.globalToken }
    });
    return response.data;
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    await axios.post(`${this.baseUrl}/webhook/set/${instanceName}`, {
      enabled: true,
      url: webhookUrl,
      events: ["MESSAGES_UPSERT"]
    }, { headers: { apikey: this.globalToken } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/evolutionService.ts
git commit -m "feat: implement Evolution API service client"
```

---

### Task 3: Backend - WhatsApp Management Routes

**Files:**
- Create: `backend/src/routes/whatsappRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create management endpoints**

```typescript
// backend/src/routes/whatsappRoutes.ts
import { Router } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { EvolutionService } from '../services/evolutionService';

const router = Router();
router.use(authenticate);

router.post('/setup', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { evolutionApiUrl, evolutionGlobalToken } = req.body;
  await db.update(tenants).set({ evolutionApiUrl, evolutionGlobalToken }).where(eq(tenants.id, tenantId!));
  res.json({ success: true });
});

router.post('/instance/create', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId!));
  
  if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken) {
    return res.status(400).json({ error: 'Evolution API credentials not configured' });
  }

  const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
  const result = await evo.createInstance(tenant.slug);
  
  await db.update(tenants).set({ 
    whatsappInstanceId: tenant.slug,
    whatsappToken: result.hash // instance token
  }).where(eq(tenants.id, tenantId!));

  // Set Webhook automatically
  const webhookUrl = `${process.env.BACKEND_URL}/api/webhook/evolution/${tenantId}`;
  await evo.setWebhook(tenant.slug, webhookUrl);

  res.json(result);
});

// ... Add GET /qrcode and GET /status
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts
import whatsappRoutes from './routes/whatsappRoutes';
app.use('/api/whatsapp', whatsappRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/whatsappRoutes.ts backend/src/app.ts
git commit -m "feat: add whatsapp management routes"
```

---

### Task 4: Frontend - WhatsApp Configuration Page

**Files:**
- Create: `frontend/src/pages/Dashboard/WhatsAppConfig.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement the WhatsApp config UI**

```tsx
// frontend/src/pages/Dashboard/WhatsAppConfig.tsx
// Features: Form for Evolution URL/Token, QR Code display, Connection Status badge
```

- [ ] **Step 2: Update routes in `App.tsx`**

```tsx
// frontend/src/App.tsx
import WhatsAppConfig from './pages/Dashboard/WhatsAppConfig';
// ...
<Route path="whatsapp" element={<WhatsAppConfig />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard/WhatsAppConfig.tsx frontend/src/App.tsx
git commit -m "ui: implement WhatsApp configuration page with QR Code"
```
