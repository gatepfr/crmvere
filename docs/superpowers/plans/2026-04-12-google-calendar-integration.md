# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Google Calendar into the dashboard by allowing councilors to configure an embed link and view/manage appointments within a new "Agenda" tab.

**Architecture:** 
- Add `calendar_url` to the `tenants` table in the database.
- Update backend configuration routes to support saving and retrieving the calendar URL.
- Add a configuration field in the frontend Cabinet settings.
- Create a new "Agenda" page in the frontend that displays the calendar in an iframe.
- Add the "Agenda" link to the sidebar navigation.

**Tech Stack:** 
- Backend: Node.js, Express, Drizzle ORM, PostgreSQL.
- Frontend: React, TypeScript, Tailwind CSS, Lucide React (icons).

---

### Task 1: Database Migration

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add calendarUrl column to tenants table**

```typescript
// backend/src/db/schema.ts
// Add this line to the tenants table definition:
export const tenants = pgTable("tenants", {
  // ... existing fields
  evolutionGlobalToken: varchar("evolution_global_token", { length: 255 }),
  calendarUrl: varchar("calendar_url", { length: 1000 }), // Add this
  // ... cabinet info
});
```

- [ ] **Step 2: Generate and run the migration**

Run: `cd backend && npx drizzle-kit generate && npx drizzle-kit push`
Expected: Database schema updated with the new column.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: add calendarUrl to tenants table"
```

---

### Task 2: Backend Route Update

**Files:**
- Modify: `backend/src/routes/configRoutes.ts`

- [ ] **Step 1: Update the update route to include calendarUrl**

```typescript
// backend/src/routes/configRoutes.ts
router.patch('/update', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const { 
    name, 
    aiProvider, 
    aiApiKey, 
    aiModel, 
    aiBaseUrl,
    systemPrompt,
    municipio,
    uf,
    partido,
    mandato,
    fotoUrl,
    calendarUrl // Add this
  } = req.body;

  await db.update(tenants)
    .set({ 
      name, 
      aiProvider, 
      aiApiKey, 
      aiModel, 
      aiBaseUrl,
      systemPrompt,
      municipio,
      uf,
      partido,
      mandato,
      fotoUrl,
      calendarUrl // Add this
    })
    .where(eq(tenants.id, tenantId));
    
  res.json({ success: true });
});
```

- [ ] **Step 2: Verify the GET /me route automatically returns the new field**
(Since `db.select().from(tenants)` is used, it should include all fields).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/configRoutes.ts
git commit -m "feat(backend): support calendarUrl in config routes"
```

---

### Task 3: Frontend Configuration UI

**Files:**
- Modify: `frontend/src/pages/Dashboard/CabinetConfig.tsx`

- [ ] **Step 1: Update the state and form to include calendarUrl**

```typescript
// frontend/src/pages/Dashboard/CabinetConfig.tsx
// Update config state:
const [config, setConfig] = useState({
  name: '',
  municipio: '',
  uf: '',
  partido: '',
  mandato: '',
  fotoUrl: '',
  calendarUrl: '' // Add this
});

// Update useEffect to load calendarUrl:
useEffect(() => {
  api.get('/config/me')
    .then(res => {
      setConfig({
        name: res.data.name || '',
        municipio: res.data.municipio || '',
        uf: res.data.uf || '',
        partido: res.data.partido || '',
        mandato: res.data.mandato || '',
        fotoUrl: res.data.fotoUrl || '',
        calendarUrl: res.data.calendarUrl || '' // Add this
      });
    })
    // ...
}, []);

// Add input field to the form (before the photo URL field or in a new section):
<div className="space-y-2 md:col-span-2">
  <label className="block text-sm font-semibold text-slate-700">Link de Incorporação da Agenda (Google Calendar)</label>
  <input 
    type="url" 
    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
    value={config.calendarUrl}
    onChange={e => setConfig({...config, calendarUrl: e.target.value})}
    placeholder="https://calendar.google.com/calendar/embed?src=..."
  />
  <p className="text-xs text-slate-500">Cole o link 'src' do código de incorporação ou o link público da sua agenda.</p>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/CabinetConfig.tsx
git commit -m "feat(frontend): add calendarUrl field to CabinetConfig"
```

---

### Task 4: Agenda Page Component

**Files:**
- Create: `frontend/src/pages/Dashboard/Agenda.tsx`

- [ ] **Step 1: Implement the Agenda component with iframe**

```typescript
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Calendar as CalendarIcon, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Agenda() {
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/config/me')
      .then(res => setCalendarUrl(res.data.calendarUrl))
      .catch(err => console.error('Erro ao buscar agenda:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
        <p className="mt-4 text-slate-600">Carregando agenda...</p>
      </div>
    );
  }

  if (!calendarUrl) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="inline-flex items-center justify-center p-4 bg-amber-50 text-amber-600 rounded-full mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Agenda não configurada</h2>
        <p className="text-slate-600 mb-8">
          Para visualizar e gerenciar seus compromissos, você precisa configurar o link do seu Google Calendar.
        </p>
        <Link 
          to="/dashboard/cabinet"
          className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          Configurar Agora
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Agenda do Vereador</h2>
          <p className="text-slate-500">Gerencie datas e horários de compromissos.</p>
        </div>
        <a 
          href={calendarUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-semibold"
        >
          <ExternalLink size={16} className="mr-1" />
          Abrir em Nova Aba
        </a>
      </header>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <iframe 
          src={calendarUrl} 
          style={{ border: 0 }} 
          width="100%" 
          height="100%" 
          frameBorder="0" 
          scrolling="no"
          title="Google Calendar"
          className="absolute inset-0"
        ></iframe>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/Agenda.tsx
git commit -m "feat(frontend): create Agenda page with Google Calendar iframe"
```

---

### Task 5: Routing and Navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Register the Agenda route in App.tsx**

```typescript
// frontend/src/App.tsx
import Agenda from './pages/Dashboard/Agenda'; // Add import

// Inside DashboardLayout routes:
<Route path="demands" element={<Demands />} />
<Route path="agenda" element={<Agenda />} /> // Add this
<Route path="map" element={<VoterMap />} />
```

- [ ] **Step 2: Add Agenda to Sidebar.tsx**

```typescript
// frontend/src/components/Sidebar.tsx
import { 
  LayoutDashboard, 
  MessageSquare, 
  Calendar, // Add this
  // ...
} from 'lucide-react';

// Inside menuItems array:
const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Agenda', icon: Calendar, path: '/dashboard/agenda' }, // Add this
  { name: 'Demandas', icon: MessageSquare, path: '/dashboard/demands' },
  // ...
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): add Agenda route and sidebar item"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Verify database migration worked**
- [ ] **Step 2: Test saving a Google Calendar link in Cabinet Settings**
- [ ] **Step 3: Access the Agenda menu and verify the iframe loads correctly**
- [ ] **Step 4: Check responsiveness**
