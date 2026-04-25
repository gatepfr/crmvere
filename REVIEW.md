---
phase: code-review
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/src/routes/demandRoutes.ts
  - backend/src/services/reportService.ts
  - frontend/src/components/DemandModal.tsx
  - frontend/src/components/LegislativoEditModal.tsx
  - frontend/src/pages/Dashboard/Municipes.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed covering the recent Express route ordering fix, PDF report service redesign, category name normalisation in both modals, and Bairro column alignment in the Municipes table.

The route ordering fix (`demandRoutes.ts`) is correct and well-commented. The PDF redesign (`reportService.ts`) is clean and functional. The category normalisation logic in both modals is correct.

The main concerns are: one critical security issue (unvalidated URL injected directly into an HTML `src` attribute), several missing-error-handling and state-consistency bugs in the frontend, and a route naming inconsistency that can cause 404s at runtime.

---

## Critical Issues

### CR-01: Unsanitised photo URL injected into HTML `src` — potential data-exfiltration / SSRF

**File:** `backend/src/services/reportService.ts:202-203`

**Issue:** `tenant.fotoUrl` is accepted from the database and dropped directly into the Puppeteer HTML template as an `<img src="...">` attribute. The only guard is a prefix check (`isSafeUrl`), which only verifies `http://` or `https://`. This check is performed client-side *in the rendering context of Puppeteer (Chromium)*. A compromised or manipulated tenant record could supply a URL that:

1. Leaks the internal network topology (Chromium will follow the URL at render time — SSRF).
2. Contains a `javascript:` URL if the prefix check is somehow bypassed (e.g., `  javascript:...` with leading whitespace — the current `startsWith` check does not trim).
3. Triggers a DNS rebinding attack against internal services reachable from the Docker container running Chromium.

```typescript
// Current (vulnerable)
const isSafeUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
const fotoHtml = tenant.fotoUrl && isSafeUrl(tenant.fotoUrl)
  ? `<img src="${tenant.fotoUrl}" ...`
```

**Fix:** Trim the URL before checking, and pass Puppeteer's `--disable-web-security` only if absolutely needed. More importantly, block private-network ranges by validating the hostname, or disable remote image loading entirely and serve the photo through a safe proxy:

```typescript
const isSafeUrl = (url: string) => {
  const trimmed = url.trim();
  return (trimmed.startsWith('https://') || trimmed.startsWith('http://'))
    && !/localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./i.test(trimmed);
};

// Also use the trimmed value in the attribute:
const fotoHtml = tenant.fotoUrl && isSafeUrl(tenant.fotoUrl)
  ? `<img src="${tenant.fotoUrl.trim()}" ...`
  : fallbackDiv;
```

For a more robust fix, resolve the image server-side (fetch → base64) before passing it to the template, so Puppeteer never makes outbound requests.

---

## Warnings

### WR-01: Route prefix inconsistency — `municipe` vs `municipes` causes runtime 404s

**File:** `backend/src/routes/demandRoutes.ts:50-51`

**Issue:** Individual municipe PATCH/DELETE routes use the singular prefix `/municipe/:id`, while the list/create/import routes use the plural `/municipes`. The frontend calls `/demands/municipe/:id` (singular), which is consistent with the backend — but the asymmetry is fragile and already diverges from the bulk route at line 47 (`/municipes/list`). Any future developer adding a new route for a single municipe is likely to choose the wrong prefix.

```
router.get('/municipes/list', listMunicipes);     // plural
router.post('/municipes', createMunicipe);         // plural
router.patch('/municipe/:id', updateMunicipe);     // singular ← inconsistency
router.delete('/municipe/:id', deleteMunicipe);    // singular ← inconsistency
```

**Fix:** Standardise on the plural prefix throughout:

```typescript
router.patch('/municipes/:id', updateMunicipe);
router.delete('/municipes/:id', deleteMunicipe);
```

And update every frontend call from `/demands/municipe/${id}` to `/demands/municipes/${id}` (affects `DemandModal.tsx`, `LegislativoEditModal.tsx`, and `Municipes.tsx`).

---

### WR-02: `isLegislativo`, `numeroIndicacao`, `documentUrl` are `const` — `handleUpdateLegislativo` always saves stale initial values

**File:** `frontend/src/components/DemandModal.tsx:65-67, 178-189`

**Issue:** The three legislative fields are declared with `const [isLegislativo] = useState(...)` — the setter is deliberately discarded. `handleUpdateLegislativo` (line 181) then PATCH-es these frozen values back to the server. The user has no way to edit them via this modal, yet the save button still exists. The result is that pressing "Salvar" on the legislative section re-writes the same original data (a no-op at best; silently discards any edit the user might expect to make at worst). The button exists and the handler fires, leading to confusing UX.

**Fix:** Either expose the setters so the fields are editable, or remove `handleUpdateLegislativo` and its button from the modal since this modal is not the editing surface for legislative fields (that role belongs to `LegislativoEditModal`).

```typescript
// If the section is display-only, remove the save call:
// const handleUpdateLegislativo = ... // delete entirely
// And remove the associated button from JSX
```

---

### WR-03: Empty `catch` block silently swallows timeline load errors

**File:** `frontend/src/components/LegislativoEditModal.tsx:115`

**Issue:** The `loadTimeline` function has a bare empty `catch {}` that discards any network or server error. If the timeline fails to load, the user sees an empty list with no indication of failure, and the developer has no log to diagnose the issue.

```typescript
// Current
try {
  const res = await api.get(`/demands/${demand.demandas.id}/timeline`);
  setTimeline(res.data);
} catch {}           // ← silent failure
finally { setTimelineLoading(false); }
```

**Fix:**

```typescript
} catch (err) {
  console.error('Erro ao carregar timeline:', err);
  // Optionally: setTimeline([]); and show an error message to the user
}
```

---

### WR-04: `loadMunicipes` captures stale `cabinetConfig` in its dependency array, causing an infinite render loop risk

**File:** `frontend/src/pages/Dashboard/Municipes.tsx:118-144`

**Issue:** `cabinetConfig` is included in the `useCallback` dependency array at line 144. Inside `loadMunicipes`, when `cabinetConfig` is `null`, the function fetches config and calls `setCabinetConfig(configRes.data)`. This state update changes `cabinetConfig`, which invalidates the `useCallback` memoisation, which triggers the `useEffect` on line 146 again. In practice this loop terminates because after the first fetch `cabinetConfig` is non-null and the fetch is skipped, but the double-render on mount is unnecessary and the pattern is fragile — any change to `loadMunicipes` risks reintroducing an infinite loop.

**Fix:** Fetch the cabinet config in a separate `useEffect` with an empty dependency array, and keep `cabinetConfig` out of `loadMunicipes`'s dependencies:

```typescript
useEffect(() => {
  api.get('/config/me').then(res => setCabinetConfig(res.data)).catch(() => {});
}, []);

const loadMunicipes = useCallback(async () => {
  setLoading(true);
  try {
    // cabinetConfig no longer fetched here
    const params = new URLSearchParams({ ... });
    ...
  }
}, [pagination.page, pagination.limit, searchTerm, selectedBairro, onlyLideranca, onlyBirthdays, sortConfig]);
// cabinetConfig removed from deps
```

---

### WR-05: `handleSendBroadcast` continues sending after individual failure instead of surfacing per-recipient errors

**File:** `frontend/src/pages/Dashboard/Municipes.tsx:262-282`

**Issue:** The broadcast loop catches errors per-recipient but only logs them to the console (line 272). The user sees "Mensagens enviadas com sucesso!" at the end regardless of how many deliveries failed. In a multi-tenant CRM context where reliability matters, silent partial failure is a significant UX bug.

```typescript
} catch (err) { console.error(`Erro ao enviar para ${municipe.name}:`, err); }
// ... loop continues; final alert says success unconditionally
```

**Fix:** Accumulate failures and report them:

```typescript
const failures: string[] = [];
// inside catch:
failures.push(municipe.name);
// after loop:
if (failures.length > 0) {
  alert(`Envio concluído. Falhas: ${failures.join(', ')}`);
} else {
  alert('Mensagens enviadas com sucesso!');
}
```

---

### WR-06: `loadAllBairros` fetches up to 1000 records just to extract unique bairro values — server-side filtering missing

**File:** `frontend/src/pages/Dashboard/Municipes.tsx:108-116`

**Issue:** `loadAllBairros` calls `/demands/municipes/list?limit=1000`, downloads up to 1000 full municipe records, and then extracts unique bairros client-side. This is wasteful over a slow connection and will silently miss bairros beyond the 1000-record cutoff. More importantly, the backend already has the data to return a distinct bairro list cheaply.

**Fix:** Add a dedicated `/demands/municipes/bairros` backend endpoint returning `string[]`, then replace `loadAllBairros` with a single lightweight call. As a short-term fix with no backend change, increase the limit to `all` or handle the pagination of the bairro list.

---

## Info

### IN-01: Doubled variable name `setSelectedSelectedMunicipes` is a naming error

**File:** `frontend/src/pages/Dashboard/Municipes.tsx:78`

**Issue:** The state setter is named `setSelectedSelectedMunicipes` (double "Selected"), used consistently throughout the file but clearly a typo from the original `useState` destructure. It does not cause a runtime bug but reduces readability.

```typescript
// Line 78
const [selectedMunicipes, setSelectedSelectedMunicipes] = useState<string[]>([]);
```

**Fix:** Rename to `setSelectedMunicipes`.

---

### IN-02: `demand` prop typed as `any` in both modals

**File:** `frontend/src/components/DemandModal.tsx:22`, `frontend/src/components/LegislativoEditModal.tsx:22`

**Issue:** Both modal components accept `demand: any`. This suppresses all TypeScript safety on the most important data object in the component. Any typo accessing `demand.demandas.somField` becomes a silent runtime `undefined`.

**Fix:** Define a shared `DemandRow` interface (or import from a shared types file) with the shape `{ demandas: {...}, municipes: {...}, atendimentoId?: string }` and use it on both props.

---

### IN-03: `console.error` left in production code across multiple files

**Files:**
- `frontend/src/pages/Dashboard/Municipes.tsx:113, 139, 272, 335`
- `frontend/src/components/DemandModal.tsx:119`

**Issue:** Several `console.error` calls are appropriate for development but should be gated or replaced with a logging service in production to avoid leaking internal error details and request structure to browser dev tools.

**Fix:** Replace with a project-wide logger utility or wrap in `if (process.env.NODE_ENV !== 'production')` guards where the output is only diagnostic. Error details shown to the user (via `alert`) are already sanitised, so this is a dev-tool exposure issue only.

---

### IN-04: `formatPeriod` uses `T12:00:00` noon-fix — fragile for non-UTC timezones

**File:** `backend/src/services/reportService.ts:192`

**Issue:** `formatPeriod` appends `T12:00:00` to force noon so that `toLocaleDateString` does not roll back to the previous day due to UTC-offset. This works for Brazil (UTC-3) but would silently misdisplay in UTC+13 or UTC+14. The pattern is a common workaround but is not documented and will be confusing to maintainers.

```typescript
new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR', ...)
```

**Fix:** Use `Intl.DateTimeFormat` with `timeZone: 'America/Sao_Paulo'` explicitly, or parse the date string directly with `{ timeZone: 'UTC' }` to avoid the ambiguity:

```typescript
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
```

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
