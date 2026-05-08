# Instagram OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual Instagram access token input with a proper Meta OAuth flow — tenant clicks "Conectar com Instagram", authorizes via Meta, and a never-expiring Page Access Token is saved automatically.

**Architecture:** Follows the existing `calendarRoutes.ts` OAuth pattern — a single new router (`instagramOAuthRoutes.ts`) with a public callback at the top and `router.use(authenticate)` before protected routes. The callback exchanges the authorization code for a Page Access Token through 5 sequential Graph API calls, then saves to the tenant record and redirects to the frontend. The frontend detects `?connected=true` / `?error=...` URL params on mount.

**Tech Stack:** Express, axios, Drizzle ORM, React + Vitest + supertest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/.env.example` | Modify | Add META_APP_ID and META_APP_SECRET placeholders |
| `backend/.env` | Modify | Add actual META_APP_ID and META_APP_SECRET values |
| `backend/src/routes/instagramOAuthRoutes.ts` | Create | Public callback + authenticated start/disconnect routes |
| `backend/src/app.ts` | Modify | Register instagramOAuthRoutes before `authenticate` middleware |
| `backend/src/__tests__/instagramOAuthRoutes.test.ts` | Create | Unit tests for all 3 new endpoints |
| `frontend/src/pages/Dashboard/InstagramConfig.tsx` | Modify | Replace manual token input with OAuth connect/disconnect UI |

---

## Task 1: Add Meta env vars

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/.env`

- [ ] **Step 1: Add to .env.example**

Add these two lines to `backend/.env.example`:

```
META_APP_ID=your_meta_app_id_here
META_APP_SECRET=your_meta_app_secret_here
```

- [ ] **Step 2: Add to .env**

Add the real values to `backend/.env` (obtain from developers.facebook.com → your app → App Settings → Basic):

```
META_APP_ID=<paste App ID here>
META_APP_SECRET=<paste App Secret here>
```

- [ ] **Step 3: Commit**

```bash
rtk git add backend/.env.example
rtk git commit -m "chore: add META_APP_ID and META_APP_SECRET env vars"
```

> Note: Never commit `backend/.env` — it is already gitignored.

---

## Task 2: Create instagramOAuthRoutes.ts (TDD)

**Files:**
- Create: `backend/src/__tests__/instagramOAuthRoutes.test.ts`
- Create: `backend/src/routes/instagramOAuthRoutes.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/instagramOAuthRoutes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

vi.mock('../db', () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('axios');
import axios from 'axios';

const mockAxiosGet = vi.mocked(axios.get);
const mockAxiosPost = vi.mocked(axios.post);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = 'test_app_id';
  process.env.META_APP_SECRET = 'test_app_secret';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.BACKEND_URL = 'http://localhost:3001';
});

describe('GET /api/instagram/oauth/start', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/instagram/oauth/start');
    expect(res.status).toBe(401);
  });

  it('returns Meta authorization URL with tenantId as state', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      process.env.JWT_SECRET || 'supersecret'
    );

    const res = await request(app)
      .get('/api/instagram/oauth/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('facebook.com/v21.0/dialog/oauth');
    expect(res.body.url).toContain('state=tenant-123');
    expect(res.body.url).toContain('client_id=test_app_id');
  });
});

describe('GET /api/instagram/oauth/callback', () => {
  it('redirects with ?error=cancelado when no code', async () => {
    const res = await request(app).get('/api/instagram/oauth/callback?state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?error=cancelado when Meta returns error', async () => {
    const res = await request(app).get('/api/instagram/oauth/callback?error=access_denied&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?connected=true on success', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } })   // short-lived token
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } })    // long-lived token
      .mockResolvedValueOnce({ data: { data: [{ id: 'page1', access_token: 'page_token' }] } }) // pages
      .mockResolvedValueOnce({ data: { instagram_business_account: { id: 'ig123' }, access_token: 'page_token' } }); // page details

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('connected=true');
  });

  it('redirects with ?error=sem_conta_instagram when no Instagram Business Account found', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } })
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } })
      .mockResolvedValueOnce({ data: { data: [{ id: 'page1', access_token: 'page_token' }] } })
      .mockResolvedValueOnce({ data: { access_token: 'page_token' } }); // no instagram_business_account

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=sem_conta_instagram');
  });

  it('redirects with ?error=falha_meta on Graph API error', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('Graph API error'));

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=falha_meta');
  });
});

describe('POST /api/instagram/oauth/disconnect', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/instagram/oauth/disconnect');
    expect(res.status).toBe(401);
  });

  it('clears token and accountId, returns success', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      process.env.JWT_SECRET || 'supersecret'
    );

    const { db } = await import('../db');
    const res = await request(app)
      .post('/api/instagram/oauth/disconnect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && pnpm test src/__tests__/instagramOAuthRoutes.test.ts
```

Expected: FAIL — `instagramOAuthRoutes` not registered in app yet.

- [ ] **Step 3: Create instagramOAuthRoutes.ts**

Create `backend/src/routes/instagramOAuthRoutes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';

const router = Router();

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/instagram/oauth/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GRAPH_URL = 'https://graph.facebook.com/v21.0';

// PUBLIC — Meta redirects here after user authorizes
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=cancelado`);
  }

  try {
    // Step 1: Exchange code for short-lived user token
    const shortRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: REDIRECT_URI, code },
    });
    const shortLivedToken: string = shortRes.data.access_token;

    // Step 2: Exchange for long-lived user token (60 days)
    const longRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: shortLivedToken },
    });
    const longLivedToken: string = longRes.data.access_token;

    // Step 3: List Facebook Pages
    const pagesRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
      params: { access_token: longLivedToken },
    });
    const pages: Array<{ id: string; access_token: string }> = pagesRes.data.data;

    // Steps 4 & 5: Find a Page with an Instagram Business Account
    let pageToken: string | null = null;
    let igAccountId: string | null = null;

    for (const page of pages) {
      const pageRes = await axios.get(`${GRAPH_URL}/${page.id}`, {
        params: { fields: 'instagram_business_account,access_token', access_token: longLivedToken },
      });
      if (pageRes.data.instagram_business_account) {
        pageToken = pageRes.data.access_token;
        igAccountId = pageRes.data.instagram_business_account.id;
        break;
      }
    }

    if (!pageToken || !igAccountId) {
      return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=sem_conta_instagram`);
    }

    // Step 6: Save to tenant
    await db.update(tenants)
      .set({ instagramAccessToken: pageToken, instagramAccountId: igAccountId })
      .where(eq(tenants.id, state));

    res.redirect(`${FRONTEND_URL}/dashboard/instagram?connected=true`);
  } catch (err: any) {
    console.error('[INSTAGRAM OAUTH CALLBACK ERROR]', err.message);
    res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=falha_meta`);
  }
});

// ALL ROUTES BELOW REQUIRE AUTH
router.use(authenticate);

// GET /api/instagram/oauth/start — returns Meta authorization URL
router.get('/oauth/start', (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', META_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'instagram_basic,instagram_manage_messages,pages_messaging,pages_read_engagement,instagram_manage_comments');
  url.searchParams.set('state', tenantId);
  url.searchParams.set('response_type', 'code');

  res.json({ url: url.toString() });
});

// POST /api/instagram/oauth/disconnect — clears token and account ID
router.post('/oauth/disconnect', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  await db.update(tenants)
    .set({ instagramAccessToken: null, instagramAccountId: null })
    .where(eq(tenants.id, tenantId));

  res.json({ success: true });
});

export default router;
```

- [ ] **Step 4: Run tests — still fail (not registered in app yet)**

```bash
cd backend && pnpm test src/__tests__/instagramOAuthRoutes.test.ts
```

Expected: FAIL — routes not found (404).

- [ ] **Step 5: Register routes in app.ts**

Open `backend/src/app.ts`. Add the import at line 24 (after instagramRoutes import):

```typescript
import instagramOAuthRoutes from './routes/instagramOAuthRoutes';
```

Then add the registration before `app.use(authenticate)` at line 57, following the calendar pattern at line 54:

```typescript
// Instagram OAuth routes (callback is public; auth applied internally after callback)
app.use('/api/instagram', instagramOAuthRoutes);
```

The section should look like:

```typescript
// 2. AUTH (Public)
app.use('/api/auth', authRoutes);

// Calendar routes (callback is public; auth applied internally after callback)
app.use('/api/calendar', calendarRoutes);

// Instagram OAuth routes (callback is public; auth applied internally after callback)
app.use('/api/instagram', instagramOAuthRoutes);

// 3. PROTECTED ROUTES (Require Login)
app.use(authenticate);
```

- [ ] **Step 6: Run tests — all pass**

```bash
cd backend && pnpm test src/__tests__/instagramOAuthRoutes.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
cd backend && pnpm test
```

Expected: All existing tests still pass.

- [ ] **Step 8: Commit**

```bash
rtk git add backend/src/routes/instagramOAuthRoutes.ts backend/src/app.ts backend/src/__tests__/instagramOAuthRoutes.test.ts
rtk git commit -m "feat: implement Instagram OAuth flow with Page Token exchange"
```

---

## Task 3: Frontend — replace manual token with OAuth button

**Files:**
- Modify: `frontend/src/pages/Dashboard/InstagramConfig.tsx`

- [ ] **Step 1: Add URL param handling on mount**

In `InstagramConfig.tsx`, after the existing `useEffect` that calls `fetchConfig/fetchStatus/fetchRules/fetchFlows` (around line 135), add a new `useEffect`:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected') === 'true') {
    toast.success('Instagram conectado com sucesso!');
    window.history.replaceState({}, '', window.location.pathname);
    fetchStatus();
  } else if (params.get('error') === 'cancelado') {
    toast.info('Conexão cancelada.');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('error') === 'sem_conta_instagram') {
    toast.error('Nenhuma conta Instagram Business encontrada nas suas Páginas do Facebook.');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('error') === 'falha_meta') {
    toast.error('Falha ao conectar com o Meta. Tente novamente.');
    window.history.replaceState({}, '', window.location.pathname);
  }
}, [fetchStatus]);
```

- [ ] **Step 2: Add handleConnect and handleDisconnect**

Add these two functions after `handleSave` (around line 157):

```typescript
const handleConnect = async () => {
  try {
    const res = await api.get('/instagram/oauth/start');
    window.location.href = res.data.url;
  } catch {
    toast.error('Não foi possível iniciar a conexão com o Instagram.');
  }
};

const handleDisconnect = async () => {
  try {
    await api.post('/instagram/oauth/disconnect');
    await fetchStatus();
    toast.success('Instagram desconectado.');
  } catch {
    toast.error('Falha ao desconectar.');
  }
};
```

- [ ] **Step 3: Replace the manual token input section**

In the "Conexão" tab, inside `<div className="bg-card rounded-[2.5rem] ...">` (around line 315), replace the entire block from the "Access Token (Page Token)" label through the "Salvar Credenciais" button.

**Remove** (lines 321–386):
```tsx
<div className="space-y-4">
  <div>
    <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
      Access Token (Page Token)
    </label>
    <input
      type="password"
      ...
      value={config.instagramAccessToken}
      onChange={e => setConfig({ ...config, instagramAccessToken: e.target.value })}
      placeholder="EAAxxxxxxxxx..."
    />
    <p className="text-[10px] text-muted-foreground mt-1.5">
      Meta for Developers → seu App → Instagram → Token de Acesso da Página.
    </p>
  </div>

  <div>
    <label ...>Verify Token (Webhook)</label>
    <div className="flex gap-2">
      <input ... value={config.instagramWebhookVerifyToken} ... />
      <button onClick={generateVerifyToken}>...</button>
    </div>
  </div>

  <div className="p-4 bg-blue-50 ...">
    {/* webhook URL display */}
  </div>
</div>

<div className="flex justify-end pt-2">
  <button onClick={handleSave} ...>Salvar Credenciais</button>
</div>
```

**Replace with:**
```tsx
<div className="space-y-6">
  {/* OAuth Connect/Disconnect */}
  {status?.connected ? (
    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-2xl">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <div>
          <p className="text-sm font-black text-green-800 dark:text-green-300">Conta conectada</p>
          <p className="text-xs text-green-600 dark:text-green-400">@{status.username}</p>
        </div>
      </div>
      <button
        onClick={handleDisconnect}
        className="px-4 py-2 bg-white dark:bg-card border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
      >
        Desconectar
      </button>
    </div>
  ) : (
    <button
      onClick={handleConnect}
      className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-800 hover:bg-blue-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all"
    >
      <Camera size={18} />
      Conectar com Instagram
    </button>
  )}

  {/* Webhook Verify Token */}
  <div>
    <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
      Verify Token (Webhook)
    </label>
    <div className="flex gap-2">
      <input
        type="text"
        className="flex-1 px-4 py-3 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-blue-400 transition-all"
        value={config.instagramWebhookVerifyToken}
        onChange={e => setConfig({ ...config, instagramWebhookVerifyToken: e.target.value })}
        placeholder="token-secreto"
      />
      <button
        onClick={generateVerifyToken}
        className="px-4 py-3 bg-muted hover:bg-muted/80 border border-border rounded-2xl text-xs font-black text-muted-foreground whitespace-nowrap transition-all"
      >
        <Zap size={14} />
      </button>
    </div>
  </div>

  {/* Webhook URL */}
  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-800">
    <p className="text-xs font-black text-blue-800 dark:text-blue-300 mb-2 uppercase tracking-widest">
      URL do Webhook
    </p>
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs text-blue-600 dark:text-blue-400 break-all font-mono">
        {webhookUrl}
      </code>
      <button onClick={copyWebhook} className="p-2 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0">
        <Copy size={14} />
      </button>
    </div>
  </div>

  {/* Save verify token button */}
  <div className="flex justify-end pt-2">
    <button
      onClick={handleSave}
      disabled={saving}
      className="flex items-center gap-2 px-8 py-3 bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all disabled:opacity-50"
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
      {saving ? 'Salvando...' : 'Salvar Webhook Token'}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Update the status sidebar "Passos" card**

Replace the `<ol>` inside the amber card (around line 421) with:

```tsx
<ol className="space-y-2 text-xs text-amber-700 dark:text-amber-400 font-bold list-decimal list-inside">
  <li>Clique em "Conectar com Instagram"</li>
  <li>Autorize o acesso no Meta</li>
  <li>Gere e salve o Verify Token acima</li>
  <li>Configure o Webhook com a URL acima</li>
  <li>Assine: <code>messages</code> e <code>comments</code></li>
</ol>
```

- [ ] **Step 5: Remove unused `instagramAccessToken` from config state and handleSave**

In the `config` state (line 65), remove `instagramAccessToken: ''`.

In `fetchConfig` (line 93), remove `instagramAccessToken: d.instagramAccessToken || '',`.

In `handleSave` (line 145), remove `instagramAccessToken` from the payload spread — the save now only handles webhook/DM/comment config. The `instagramAccessToken` is managed exclusively by the OAuth flow.

- [ ] **Step 6: Verify the frontend builds without TypeScript errors**

```bash
cd frontend && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
rtk git add frontend/src/pages/Dashboard/InstagramConfig.tsx
rtk git commit -m "feat: replace manual Instagram token input with OAuth connect button"
```

---

## Task 4: Meta App configuration guide

This task documents the one-time setup you must do in the Meta Developer Portal before the OAuth flow will work.

- [ ] **Step 1: Create Meta App**

1. Go to https://developers.facebook.com/apps
2. Click "Create App" → choose **Business** type
3. Name it (e.g. "CRM Vere") and click "Create App"

- [ ] **Step 2: Add Instagram and Messenger products**

On the app dashboard:
1. Click "Add Product" → find **Instagram** → click "Set Up"
2. Click "Add Product" → find **Messenger** → click "Set Up"

- [ ] **Step 3: Configure OAuth redirect URIs**

Go to App Settings → Basic → scroll to "Valid OAuth Redirect URIs":
- Add: `https://api.crmvere.com.br/api/instagram/oauth/callback`
- Add: `http://localhost:3001/api/instagram/oauth/callback` (for local dev)

- [ ] **Step 4: Copy App ID and App Secret**

Still on App Settings → Basic:
- Copy **App ID** → paste as `META_APP_ID` in `backend/.env`
- Click "Show" next to App Secret → copy → paste as `META_APP_SECRET` in `backend/.env`

- [ ] **Step 5: Add required permissions**

Go to App Review → Permissions and Features. Request (or add for dev):
- `instagram_basic`
- `instagram_manage_messages`
- `pages_messaging`
- `pages_read_engagement`
- `instagram_manage_comments`

> In development mode these work for app admins/testers without App Review. For production (any user), you must submit for App Review.

- [ ] **Step 6: Restart the backend**

```bash
cd backend && pnpm dev
```

- [ ] **Step 7: Test the full OAuth flow**

1. Open `http://localhost:5173/dashboard/instagram`
2. Click "Conectar com Instagram"
3. Authorize in Meta dialog
4. Verify redirect back to the page with success toast
5. Verify status pill shows `@username`
6. Click "Desconectar" → verify status clears
