# Instagram OAuth — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  

## Goal

Replace the current manual access token input in `InstagramConfig.tsx` with a proper Meta OAuth flow. Each tenant clicks "Conectar com Instagram" once and is automatically connected — no copying tokens. The backend exchanges the authorization code for a never-expiring Page Access Token and saves it to the tenant record.

---

## OAuth Flow (end-to-end)

```
1. Tenant clicks "Conectar com Instagram" in the UI
2. Frontend calls GET /api/instagram/oauth/start (authenticated)
3. Backend builds Meta authorization URL with state=tenantId, returns { url }
4. Frontend redirects browser to that URL

5. Meta authenticates user, redirects to:
   GET https://api.crmvere.com.br/api/instagram/oauth/callback?code=...&state=<tenantId>

6. Backend (public route):
   a. Exchange code → short-lived User Token
   b. Exchange → long-lived User Token (60 days)
   c. GET /me/accounts → list Facebook Pages
   d. For each Page, check for linked Instagram Business Account
   e. GET Page Access Token (never expires when derived from long-lived token)
   f. Save instagramAccessToken (page token) + instagramAccountId to tenant
   g. Redirect → https://crmvere.com.br/dashboard/instagram?connected=true

7. Frontend detects ?connected=true → success toast + clear URL param
```

**OAuth permissions:** `instagram_basic`, `instagram_manage_messages`, `pages_messaging`, `pages_read_engagement`, `instagram_manage_comments`

---

## Meta App Setup (one-time, manual by platform owner)

1. Go to https://developers.facebook.com → Create App → Business type
2. Add products: **Instagram** and **Messenger**
3. Under App Settings → Basic: copy **App ID** and **App Secret**
4. Under Instagram → Basic Display or Messenger → Instagram: add OAuth redirect URI:
   - Production: `https://api.crmvere.com.br/api/instagram/oauth/callback`
   - Development: `http://localhost:3001/api/instagram/oauth/callback`
5. Add required permissions to the app: `instagram_basic`, `instagram_manage_messages`, `pages_messaging`, `pages_read_engagement`, `instagram_manage_comments`
6. Submit for App Review to unlock permissions for all users (dev/test works without review)

**New backend env vars:**
```
META_APP_ID=<app_id>
META_APP_SECRET=<app_secret>
```

---

## Backend Changes

### New file: `backend/src/routes/instagramOAuthRoutes.ts`

**`GET /api/instagram/oauth/start`** — authenticated (JWT required)
- Reads `tenantId` from `req.user`
- Builds Meta OAuth URL:
  ```
  https://www.facebook.com/v21.0/dialog/oauth
    ?client_id=META_APP_ID
    &redirect_uri=https://api.crmvere.com.br/api/instagram/oauth/callback
    &scope=instagram_basic,instagram_manage_messages,pages_messaging,pages_read_engagement,instagram_manage_comments
    &state=<tenantId>
    &response_type=code
  ```
- Returns `{ url: string }`

**`GET /api/instagram/oauth/callback`** — public (no JWT)
- Receives `code` and `state` (tenantId) from Meta
- On any error: redirects to `https://crmvere.com.br/dashboard/instagram?error=<message>`
- Steps:
  1. `POST https://graph.facebook.com/v21.0/oauth/access_token` → short-lived user token
  2. `GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` → long-lived user token
  3. `GET https://graph.facebook.com/v21.0/me/accounts?access_token=<long_lived>` → pages array
  4. For each page: `GET https://graph.facebook.com/v21.0/<page_id>?fields=instagram_business_account,access_token` 
  5. Find the first page with `instagram_business_account`
  6. Save `instagramAccessToken = page.access_token`, `instagramAccountId = page.instagram_business_account.id` to tenant via Drizzle
  7. `res.redirect('https://crmvere.com.br/dashboard/instagram?connected=true')`

**`POST /api/instagram/oauth/disconnect`** — authenticated (JWT required)
- Sets `instagramAccessToken = null` and `instagramAccountId = null` on the tenant
- Returns `{ success: true }`

**Error handling (callback):**
- No `code` param (user cancelled): redirect with `?error=cancelado`
- No Instagram Business Account found on any page: redirect with `?error=sem_conta_instagram`
- Any Graph API error: redirect with `?error=falha_meta`

### Modified: `backend/src/app.ts`

Register OAuth routes **before** the auth middleware so the callback is public:

```typescript
import instagramOAuthRoutes from './routes/instagramOAuthRoutes';

// Public routes (before auth middleware)
app.use('/api/instagram', instagramOAuthRoutes);

// ... auth middleware ...

// Authenticated routes
app.use('/api/instagram', instagramRoutes);
```

> Note: Express matches routes in order. The `/oauth/start` endpoint within `instagramOAuthRoutes` applies its own auth check internally via `requireAuth` middleware, so it's safe to register the router publicly and guard individual routes.

---

## Frontend Changes

### Modified: `frontend/src/pages/Dashboard/InstagramConfig.tsx`

**On mount (useEffect):**
- Parse URL params
- If `?connected=true`: `toast.success('Instagram conectado com sucesso!')` + `window.history.replaceState({}, '', location.pathname)`
- If `?error=cancelado`: toast info "Conexão cancelada."
- If `?error=sem_conta_instagram`: toast error "Nenhuma conta Instagram Business encontrada nas suas Páginas."
- If `?error=falha_meta`: toast error "Falha ao conectar com o Meta. Tente novamente."

**Aba "Conexão" — replace manual token section with:**

When `status.connected = false`:
```tsx
<button onClick={handleConnect}>
  Conectar com Instagram
</button>
```

When `status.connected = true`:
```tsx
<div>
  <span>@{status.username}</span>
  <button onClick={handleDisconnect}>Desconectar</button>
</div>
```

**`handleConnect`:**
```typescript
const handleConnect = async () => {
  const res = await api.get('/instagram/oauth/start');
  window.location.href = res.data.url;
};
```

**`handleDisconnect`:**
- Calls `POST /api/instagram/oauth/disconnect` (new endpoint — clears both `instagramAccessToken` and `instagramAccountId`)
- Refreshes status

**What stays:**
- `instagramWebhookVerifyToken` field remains (still needed for webhook verification)
- All other tabs (DMs, Comentários) unchanged
- All existing save/fetch logic for other config fields unchanged

---

## What Does NOT Change

- Database schema (no migrations needed — `instagramAccessToken` and `instagramAccountId` already exist)
- Webhook routes and verification logic
- `instagramService.ts` (sendDM, replyToComment, getAccountInfo)
- `instagramWebhookOrchestration.ts`
- All comment rules and quick reply flow endpoints

---

## Error States Summary

| Scenario | Backend action | Frontend result |
|---|---|---|
| User cancels Meta dialog | Redirect `?error=cancelado` | Info toast |
| No Instagram Business Account | Redirect `?error=sem_conta_instagram` | Error toast with guidance |
| Graph API error | Redirect `?error=falha_meta` | Error toast |
| Success | Redirect `?connected=true` | Success toast + status updates |
