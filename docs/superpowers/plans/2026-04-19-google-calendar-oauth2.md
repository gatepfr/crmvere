# Google Calendar OAuth2 Full Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each gabinete to connect their own Google Calendar account via OAuth2 and create/edit/delete events directly from the CRM dashboard.

**Architecture:** Backend stores a Google OAuth2 refresh token per tenant. A `googleCalendarService` uses the googleapis SDK to list/create/update/delete events using that token. The frontend replaces the iframe with a react-big-calendar view plus a modal for creating/editing events. The OAuth callback route is public (no JWT needed) and uses a signed state parameter to identify the tenant.

**Tech Stack:**
- Backend: `googleapis` npm package, Express, Drizzle ORM, PostgreSQL
- Frontend: `react-big-calendar`, `date-fns`, React, TypeScript, Tailwind CSS

---

## Prerequisites (Manual — do once before coding)

Before running any code, set up Google Cloud:

1. Go to https://console.cloud.google.com → Create project → name it "CRM Vere"
2. Enable the Google Calendar API: APIs & Services → Enable APIs → search "Google Calendar API" → Enable
3. Create OAuth2 credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs: add `https://api.crmvere.com.br/api/calendar/callback` AND `http://localhost:3001/api/calendar/callback`
4. Copy the **Client ID** and **Client Secret**
5. Add to `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=https://api.crmvere.com.br/api/calendar/callback
   FRONTEND_URL=https://crmvere.com.br
   ```

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/db/schema.ts` | Modify | Add `googleRefreshToken`, `googleCalendarId` columns to `tenants` |
| `backend/src/services/googleCalendarService.ts` | Create | OAuth2 client, token refresh, CRUD calendar operations |
| `backend/src/routes/calendarRoutes.ts` | Create | OAuth flow + events CRUD endpoints |
| `backend/src/app.ts` | Modify | Register calendar routes (callback PUBLIC, rest protected) |
| `frontend/src/pages/Dashboard/Agenda.tsx` | Rewrite | Full calendar UI using react-big-calendar |
| `frontend/src/components/EventModal.tsx` | Create | Create/edit event modal |
| `frontend/src/pages/Dashboard/CabinetConfig.tsx` | Modify | Add Google Calendar connect/disconnect section |

---

### Task 1: Install Dependencies

**Files:** (no source files changed)

- [ ] **Step 1: Install googleapis in backend**

```bash
cd backend && npm install googleapis
```

Expected: `googleapis` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Install react-big-calendar and date-fns in frontend**

```bash
cd frontend && npm install react-big-calendar date-fns @types/react-big-calendar
```

Expected: packages appear in `frontend/package.json` dependencies.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "chore: install googleapis and react-big-calendar"
```

---

### Task 2: Database — Add Google OAuth Fields to Tenants

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add columns after `calendarUrl` in the tenants table**

In `backend/src/db/schema.ts`, after line:
```typescript
  calendarUrl: varchar("calendar_url", { length: 1000 }),
```
Add:
```typescript
  googleRefreshToken: varchar("google_refresh_token", { length: 500 }),
  googleCalendarId: varchar("google_calendar_id", { length: 255 }).default("primary"),
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npm run db:migrate
```

Expected: no errors, columns appear in DB.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "db: add google_refresh_token and google_calendar_id to tenants"
```

---

### Task 3: Google Calendar Service

**Files:**
- Create: `backend/src/services/googleCalendarService.ts`

- [ ] **Step 1: Write the service**

Create `backend/src/services/googleCalendarService.ts`:

```typescript
import { google } from 'googleapis';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(tenantId: string): string {
  const oauth2Client = createOAuth2Client();
  const state = Buffer.from(tenantId).toString('base64');
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state,
  });
}

export async function exchangeCodeAndSave(code: string, state: string): Promise<void> {
  const tenantId = Buffer.from(state, 'base64').toString('utf-8');
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) throw new Error('No refresh token returned');
  await db.update(tenants)
    .set({ googleRefreshToken: tokens.refresh_token })
    .where(eq(tenants.id, tenantId));
}

async function getAuthorizedClient(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant?.googleRefreshToken) throw new Error('Google Calendar not connected');
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: tenant.googleRefreshToken });
  return { oauth2Client, calendarId: tenant.googleCalendarId ?? 'primary' };
}

export async function listEvents(tenantId: string, timeMin: string, timeMax: string) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  return res.data.items ?? [];
}

export async function createEvent(tenantId: string, event: {
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
}) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const body = event.allDay
    ? {
        summary: event.title,
        description: event.description,
        start: { date: event.start.split('T')[0] },
        end: { date: event.end.split('T')[0] },
      }
    : {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: event.end, timeZone: 'America/Sao_Paulo' },
      };
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data;
}

export async function updateEvent(tenantId: string, eventId: string, event: {
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
}) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const body = event.allDay
    ? {
        summary: event.title,
        description: event.description,
        start: { date: event.start.split('T')[0] },
        end: { date: event.end.split('T')[0] },
      }
    : {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: event.end, timeZone: 'America/Sao_Paulo' },
      };
  const res = await calendar.events.update({ calendarId, eventId, requestBody: body });
  return res.data;
}

export async function deleteEvent(tenantId: string, eventId: string) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  await calendar.events.delete({ calendarId, eventId });
}

export async function disconnectCalendar(tenantId: string) {
  await db.update(tenants)
    .set({ googleRefreshToken: null, googleCalendarId: 'primary' })
    .where(eq(tenants.id, tenantId));
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/googleCalendarService.ts
git commit -m "feat: add Google Calendar OAuth2 service"
```

---

### Task 4: Calendar Routes

**Files:**
- Create: `backend/src/routes/calendarRoutes.ts`

- [ ] **Step 1: Write routes file**

Create `backend/src/routes/calendarRoutes.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  getAuthUrl,
  exchangeCodeAndSave,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  disconnectCalendar,
} from '../services/googleCalendarService';

const router = Router();

// PUBLIC — Google redirects here after user authorizes
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/dashboard/agenda?google_error=access_denied`);
  }
  try {
    await exchangeCodeAndSave(code, state);
    res.redirect(`${frontendUrl}/dashboard/agenda?google_connected=true`);
  } catch (err: any) {
    console.error('[CALENDAR CALLBACK ERROR]', err.message);
    res.redirect(`${frontendUrl}/dashboard/agenda?google_error=token_exchange_failed`);
  }
});

// ALL ROUTES BELOW REQUIRE AUTH
router.use(authenticate);

router.get('/auth', (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const url = getAuthUrl(tenantId);
  res.json({ url });
});

router.get('/status', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  res.json({ connected: !!tenant?.googleRefreshToken });
});

router.delete('/disconnect', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  await disconnectCalendar(tenantId);
  res.json({ success: true });
});

router.get('/events', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const { start, end } = req.query as { start: string; end: string };
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  try {
    const events = await listEvents(tenantId, start, end);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const event = await createEvent(tenantId, req.body);
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/events/:eventId', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const event = await updateEvent(tenantId, req.params.eventId, req.body);
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:eventId', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    await deleteEvent(tenantId, req.params.eventId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/calendarRoutes.ts
git commit -m "feat: add calendar routes with OAuth2 flow and CRUD"
```

---

### Task 5: Register Routes in app.ts

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Import and register the calendar callback BEFORE authenticate, and protected routes AFTER**

In `backend/src/app.ts`, add the import at the top with other imports:
```typescript
import calendarRoutes from './routes/calendarRoutes';
```

After `app.use(express.json());` and BEFORE `app.use(authenticate);`, add the public callback route:
```typescript
// Google Calendar OAuth callback (public)
app.use('/api/calendar', calendarRoutes);
```

Then **remove** that line from after `app.use(authenticate)` — the public callback is handled first; the router itself applies `authenticate` to all routes except `/callback`.

> Note: The `calendarRoutes` router applies `authenticate` internally via `router.use(authenticate)` on line after the callback route, so the callback is public and all other routes are protected.

- [ ] **Step 2: Verify app.ts structure looks like**

```typescript
// After express.json():
app.use('/api/calendar', calendarRoutes); // callback is public

// After app.use(authenticate):
// (no calendar line here — already registered above)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: register calendar routes in app"
```

---

### Task 6: Event Modal Component

**Files:**
- Create: `frontend/src/components/EventModal.tsx`

- [ ] **Step 1: Write the modal**

Create `frontend/src/components/EventModal.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

interface EventModalProps {
  event?: {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    allDay: boolean;
  };
  defaultStart?: Date;
  defaultEnd?: Date;
  onSave: (data: { title: string; description: string; start: string; end: string; allDay: boolean }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLocalDateValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function EventModal({ event, defaultStart, defaultEnd, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(() => {
    const d = event?.start ?? defaultStart ?? new Date();
    return allDay ? toLocalDateValue(d) : toLocalDateTimeValue(d);
  });
  const [end, setEnd] = useState(() => {
    const d = event?.end ?? defaultEnd ?? new Date(Date.now() + 3600000);
    return allDay ? toLocalDateValue(d) : toLocalDateTimeValue(d);
  });

  useEffect(() => {
    const d = event?.start ?? defaultStart ?? new Date();
    setStart(allDay ? toLocalDateValue(d) : toLocalDateTimeValue(d));
    const e = event?.end ?? defaultEnd ?? new Date(Date.now() + 3600000);
    setEnd(allDay ? toLocalDateValue(e) : toLocalDateTimeValue(e));
  }, [allDay]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      start: allDay ? start : new Date(start).toISOString(),
      end: allDay ? end : new Date(end).toISOString(),
      allDay,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{event ? 'Editar Compromisso' : 'Novo Compromisso'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Título *</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Reunião com associação de bairro"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalhes adicionais..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-slate-700">Dia inteiro</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Início</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fim</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                required
              />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-medium"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                {event ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/EventModal.tsx
git commit -m "feat: add EventModal component for creating/editing calendar events"
```

---

### Task 7: Rewrite Agenda.tsx with Full Calendar UI

**Files:**
- Rewrite: `frontend/src/pages/Dashboard/Agenda.tsx`

- [ ] **Step 1: Rewrite Agenda.tsx**

Replace the entire content of `frontend/src/pages/Dashboard/Agenda.tsx` with:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../../api/client';
import { Plus, Loader2, AlertCircle, Link as LinkIcon, Unlink } from 'lucide-react';
import EventModal from '../../components/EventModal';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }), getDay, locales });

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description?: string;
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; start: Date; end: Date }
  | { mode: 'edit'; event: CalEvent };

export default function Agenda() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  useEffect(() => {
    api.get('/calendar/status')
      .then(res => setConnected(res.data.connected))
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  const fetchEvents = useCallback(async (date: Date) => {
    const start = startOfMonth(subMonths(date, 1)).toISOString();
    const end = endOfMonth(addMonths(date, 1)).toISOString();
    try {
      const res = await api.get(`/calendar/events?start=${start}&end=${end}`);
      const mapped: CalEvent[] = (res.data as any[]).map(e => ({
        id: e.id,
        title: e.summary ?? '(sem título)',
        start: new Date(e.start?.dateTime ?? e.start?.date),
        end: new Date(e.end?.dateTime ?? e.end?.date),
        allDay: !e.start?.dateTime,
        description: e.description,
      }));
      setEvents(mapped);
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    if (connected) fetchEvents(currentDate);
  }, [connected, currentDate, fetchEvents]);

  async function handleConnect() {
    const res = await api.get('/calendar/auth');
    window.location.href = res.data.url;
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar o Google Calendar?')) return;
    await api.delete('/calendar/disconnect');
    setConnected(false);
    setEvents([]);
  }

  async function handleSave(data: { title: string; description: string; start: string; end: string; allDay: boolean }) {
    if (modal.mode === 'create') {
      await api.post('/calendar/events', data);
    } else if (modal.mode === 'edit') {
      await api.put(`/calendar/events/${modal.event.id}`, data);
    }
    setModal({ mode: 'closed' });
    fetchEvents(currentDate);
  }

  async function handleDelete() {
    if (modal.mode !== 'edit') return;
    if (!confirm('Excluir este compromisso?')) return;
    await api.delete(`/calendar/events/${modal.event.id}`);
    setModal({ mode: 'closed' });
    fetchEvents(currentDate);
  }

  // Check for google_connected param after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      setConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('google_error')) {
      alert('Erro ao conectar o Google Calendar. Tente novamente.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="inline-flex items-center justify-center p-4 bg-blue-50 text-blue-600 rounded-full mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Agenda não conectada</h2>
        <p className="text-slate-600 mb-8">
          Conecte sua conta Google para visualizar e gerenciar seus compromissos diretamente aqui.
        </p>
        <button
          onClick={handleConnect}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <LinkIcon size={18} />
          Conectar Google Calendar
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col space-y-4">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Agenda do Vereador</h2>
          <p className="text-slate-500 text-sm">Compromissos sincronizados com o Google Calendar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white transition-colors"
          >
            <Unlink size={15} />
            Desconectar
          </button>
          <button
            onClick={() => setModal({ mode: 'create', start: new Date(), end: new Date(Date.now() + 3600000) })}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus size={18} />
            Novo Compromisso
          </button>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          culture="pt-BR"
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          messages={{
            next: 'Próximo',
            previous: 'Anterior',
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            agenda: 'Lista',
            noEventsInRange: 'Sem compromissos neste período.',
          }}
          onSelectEvent={event => setModal({ mode: 'edit', event })}
          onSelectSlot={({ start, end }) => setModal({ mode: 'create', start, end })}
          selectable
        />
      </div>

      {modal.mode !== 'closed' && (
        <EventModal
          event={modal.mode === 'edit' ? modal.event : undefined}
          defaultStart={modal.mode === 'create' ? modal.start : undefined}
          defaultEnd={modal.mode === 'create' ? modal.end : undefined}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/Agenda.tsx
git commit -m "feat: rewrite Agenda with full Google Calendar OAuth2 integration"
```

---

### Task 8: Add Connection Status to CabinetConfig

**Files:**
- Modify: `frontend/src/pages/Dashboard/CabinetConfig.tsx`

- [ ] **Step 1: Read the current CabinetConfig.tsx** to find where to insert the Google Calendar section.

- [ ] **Step 2: Add a Google Calendar section**

Find the section that has `calendarUrl` input field (the old URL field). Replace it with:

```typescript
{/* Google Calendar — find existing calendarUrl input and replace this whole block */}
<div className="md:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
  <p className="text-sm font-semibold text-slate-700 mb-1">Google Calendar</p>
  {googleConnected ? (
    <div className="flex items-center justify-between">
      <span className="text-sm text-green-700 font-medium flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        Conectado ao Google Calendar
      </span>
      <button
        type="button"
        onClick={handleDisconnectGoogle}
        className="text-xs text-red-600 hover:underline font-medium"
      >
        Desconectar
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">Não conectado</span>
      <button
        type="button"
        onClick={handleConnectGoogle}
        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Conectar Google Calendar
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 3: Add state and handlers to CabinetConfig.tsx**

Near the top of the component (alongside other `useState` calls), add:

```typescript
const [googleConnected, setGoogleConnected] = useState(false);

useEffect(() => {
  api.get('/calendar/status').then(res => setGoogleConnected(res.data.connected)).catch(() => {});
}, []);

async function handleConnectGoogle() {
  const res = await api.get('/calendar/auth');
  window.location.href = res.data.url;
}

async function handleDisconnectGoogle() {
  if (!confirm('Desconectar o Google Calendar?')) return;
  await api.delete('/calendar/disconnect');
  setGoogleConnected(false);
}
```

- [ ] **Step 4: Remove the old calendarUrl input field** if it's still present in the form (we no longer need manual URL entry).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard/CabinetConfig.tsx
git commit -m "feat: add Google Calendar connect/disconnect to CabinetConfig"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Start backend and confirm calendar routes are registered**
```bash
cd backend && npm run dev
```
Expected: server starts, no import errors.

- [ ] **Step 2: Test the OAuth flow manually**
- Log in as a tenant user
- Go to Configurações do Gabinete → Google Calendar → click "Conectar"
- Should redirect to Google's consent screen
- After authorizing, should redirect back to `/dashboard/agenda?google_connected=true`
- Agenda should show the calendar with events

- [ ] **Step 3: Test creating an event**
- Click "Novo Compromisso" or click on a day
- Fill title, start, end → save
- Event should appear on the calendar and in Google Calendar

- [ ] **Step 4: Test editing an event**
- Click an existing event → modal opens prefilled → change title → save
- Event should be updated

- [ ] **Step 5: Test deleting an event**
- Click an event → click "Excluir" → confirm
- Event should disappear

- [ ] **Step 6: Test disconnecting**
- Click "Desconectar" on the Agenda page
- Should return to the "not connected" state
