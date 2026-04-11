# Dashboard Modular Moderno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the VereadorCRM into a professional modular dashboard with dedicated sections for AI, WhatsApp, and Knowledge Base, using a modern Sidebar navigation and professional UI/UX.

**Architecture:** 
- **Frontend:** Implement a global Sidebar component with active route tracking. Create dedicated page components for each module (`AIConfig`, `WhatsAppConfig`, `KnowledgeBase`).
- **Backend:** Update the `tenants` table to store AI/WhatsApp configurations. Implement a middleware-driven multi-tenant isolation.
- **State Management:** Use React Context for global configuration state (connection status, active tenant info).

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React (icons), Express, Drizzle ORM, PostgreSQL.

---

### Task 1: Database Schema Update

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/drizzle/migrations/<new_migration>.sql` (via drizzle-kit)

- [ ] **Step 1: Add new fields to the `tenants` table**

```typescript
// backend/src/db/schema.ts
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  active: boolean("active").default(true),
  // New fields:
  geminiApiKey: varchar("gemini_api_key", { length: 255 }),
  aiModel: varchar("ai_model", { length: 50 }).default("gemini-1.5-flash"),
  systemPrompt: varchar("system_prompt", { length: 2000 }),
  whatsappInstanceId: varchar("whatsapp_instance_id", { length: 255 }),
  whatsappToken: varchar("whatsapp_token", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Generate and push migration**

Run: `cd backend && npx drizzle-kit push`
Expected: Database schema updated with new columns.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: add AI and WhatsApp configuration fields to tenants table"
```

---

### Task 2: Backend - Tenant Configuration API

**Files:**
- Create: `backend/src/routes/configRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create configuration routes**

```typescript
// backend/src/routes/configRoutes.ts
import { Router } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/me', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  res.json(tenant);
});

router.patch('/update', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const { name, geminiApiKey, aiModel, systemPrompt } = req.body;
  await db.update(tenants)
    .set({ name, geminiApiKey, aiModel, systemPrompt })
    .where(eq(tenants.id, tenantId));
    
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Register routes in `app.ts`**

```typescript
// backend/src/app.ts
import configRoutes from './routes/configRoutes';
// ...
app.use('/api/config', configRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/configRoutes.ts backend/src/app.ts
git commit -m "feat: add tenant configuration API routes"
```

---

### Task 3: Frontend - Layout & Sidebar Component

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the modern Sidebar component**

```tsx
// frontend/src/components/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, MessageCircle, Bot, Database, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { logout, user } = useAuth();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Demandas', icon: MessageSquare, path: '/dashboard/demands' },
    { name: 'WhatsApp', icon: MessageCircle, path: '/dashboard/whatsapp' },
    { name: 'Configuração IA', icon: Bot, path: '/dashboard/ai' },
    { name: 'Base de Dados', icon: Database, path: '/dashboard/knowledge' },
  ];

  return (
    <div className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          VereadorCRM
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center mb-4 px-2">
          <div className="ml-3">
            <p className="text-xs text-slate-400 truncate w-32">{user?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center w-full px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
          <LogOut className="mr-3 h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `App.tsx` to use the new layout**

```tsx
// frontend/src/App.tsx
// ... import Sidebar
function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/App.tsx
git commit -m "ui: implement modern Sidebar and Dashboard layout"
```

---

### Task 4: Frontend - AI Configuration Page

**Files:**
- Create: `frontend/src/pages/Dashboard/AIConfig.tsx`

- [ ] **Step 1: Implement AIConfig page**

```tsx
// frontend/src/pages/Dashboard/AIConfig.tsx
import { useState, useEffect } from 'react';
import api from '../../api/client';

export default function AIConfig() {
  const [config, setConfig] = useState({ geminiApiKey: '', aiModel: '', systemPrompt: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/config/me').then(res => setConfig(res.data));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    await api.patch('/config/update', config);
    setLoading(false);
    alert('Configuração salva!');
  };

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Configuração de IA</h2>
        <p className="text-slate-500">Ajuste o comportamento do Gemini no seu gabinete.</p>
      </header>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Key</label>
          <input 
            type="password" 
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={config.geminiApiKey || ''}
            onChange={e => setConfig({...config, geminiApiKey: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Modelo</label>
          <select 
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={config.aiModel || 'gemini-1.5-flash'}
            onChange={e => setConfig({...config, aiModel: e.target.value})}
          >
            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Inteligente)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Prompt de Sistema (Personalidade)</label>
          <textarea 
            rows={6}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={config.systemPrompt || ''}
            onChange={e => setConfig({...config, systemPrompt: e.target.value})}
            placeholder="Ex: Você é o assistente virtual do Vereador... Seja educado e foque em saúde e educação."
          />
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/AIConfig.tsx
git commit -m "feat: implement AI Configuration page"
```

---

### Task 5: Backend - AI Service Refactor

**Files:**
- Modify: `backend/src/services/aiService.ts`

- [ ] **Step 1: Update AI service to use tenant-specific config**

```typescript
// backend/src/services/aiService.ts
// ... imports
export async function processDemand(messageText: string, config: { apiKey: string, model: string, prompt: string }, context?: string) {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });
  
  const prompt = `
    ${config.prompt}
    
    Mensagem do cidadão: ${messageText}
    ... rest of prompt logic ...
  `;
  // ... execute and return
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/aiService.ts
git commit -m "refactor: support tenant-specific AI settings in aiService"
```
