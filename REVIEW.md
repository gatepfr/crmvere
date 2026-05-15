---
phase: code-review
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - backend/src/controllers/demandController.ts
  - frontend/src/components/LegislativoEditModal.tsx
  - frontend/src/pages/Dashboard/FormularioPublico.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-05-15
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed covering backend demand management (demandController.ts), the legislativo edit modal (LegislativoEditModal.tsx), and the public form page (FormularioPublico.tsx). The code is generally well-structured and the recent features are functional.

The most significant finding is a phone number data integrity bug in FormularioPublico: the formatted display value is sent to the backend instead of the raw normalized number, which can corrupt stored phone data when a user edits the phone field. Several missing tenant-authorization checks in the backend are also flagged as they allow cross-tenant data access by any authenticated user.

---

## Critical Issues

### CR-01: Phone sent as formatted display string, not normalized number

**File:** `frontend/src/pages/Dashboard/FormularioPublico.tsx:137,174-178`

**Issue:** `editPhone` is initialized with `formatPhone(d.municipes.phone)` (produces `"(11) 99999-8888"`) and is edited directly by the user as a formatted string. In `handleSave`, this formatted display value is sent unchanged to `PATCH /demands/municipes/:id` as the `phone` field. The backend `normalizePhone` will strip non-digits and may add `55` again — but if the user typed a new number in display format (e.g., `(11) 98765-4321`), `normalizePhone` strips it to `11987654321` (11 digits) and correctly prefixes to `5511987654321`. However, the `hasChanges` comparison on line 197 compares `editPhone` (display-formatted) against `formatPhone(selected.municipes.phone)` (also display-formatted), meaning a user who edits the phone will trigger a save but the raw number passed is never validated client-side. More critically, unlike `LegislativoEditModal` which correctly separates `displayPhone` (UI state) from `municipe.phone` (DB state), `FormularioPublico` has only one phone state variable serving both purposes. If the user clears and re-types a number, there is no mask applied (`applyPhoneMask` is missing), so raw partial input such as `"(11) 9"` will be sent to the backend.

**Fix:** Introduce a separate raw phone state and a mask handler, mirroring the pattern already used in `LegislativoEditModal`:

```tsx
// State
const [editPhoneDisplay, setEditPhoneDisplay] = useState('');
const [editPhoneRaw, setEditPhoneRaw] = useState('');

// In openModal:
setEditPhoneDisplay(formatPhone(d.municipes.phone));
setEditPhoneRaw(d.municipes.phone); // store the raw normalized number

// Add mask handler:
const applyPhoneMask = (value: string) => {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  let masked = raw;
  if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length === 10) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  if (raw.length === 11) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  setEditPhoneDisplay(masked);
  setEditPhoneRaw(raw.startsWith('55') ? raw : `55${raw}`);
};

// In the phone <input>:
value={editPhoneDisplay}
onChange={e => applyPhoneMask(e.target.value)}

// In handleSave — send the raw number:
promises.push(api.patch(`/demands/municipes/${selected.municipes.id}`, {
  name: editNome,
  phone: editPhoneRaw,  // raw normalized digits, not display string
}));

// In hasChanges — compare raw values:
editPhoneRaw !== selected.municipes.phone
```

---

## Warnings

### WR-01: updateMunicipe and deleteMunicipe have no tenant authorization check

**File:** `backend/src/controllers/demandController.ts:98-121`

**Issue:** Both `updateMunicipe` (line 98) and `deleteMunicipe` (line 115) perform their database operations using only the `id` URL parameter with no `tenantId` filter. Any authenticated user from a different tenant can modify or delete any municipe by guessing or discovering a UUID, bypassing tenant isolation entirely.

**Fix:**
```typescript
export const updateMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  // ... build updateData ...
  const [u] = await db.update(municipes).set(updateData)
    .where(and(eq(municipes.id, id), eq(municipes.tenantId, tenantId)))
    .returning();
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
};

export const deleteMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  await db.delete(municipes)
    .where(and(eq(municipes.id, id), eq(municipes.tenantId, tenantId)));
  res.json({ success: true });
};
```

### WR-02: updateDemand does not return 404 when the demand is not found

**File:** `backend/src/controllers/demandController.ts:354-373`

**Issue:** `updateDemand` selects `existing` to record the old status for the activity log (line 354), but never checks whether the record was found. If `id` does not exist for the tenant, `existing` is `undefined`, the `db.update` silently affects zero rows, and the response still returns `{ success: true }`. The optional-chaining on `existing?.status` at line 370 masks this logic error.

**Fix:**
```typescript
const [existing] = await db.select({ status: demandas.status })
  .from(demandas)
  .where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
if (!existing) return res.status(404).json({ error: 'Demand not found' });
// rest of update logic unchanged
```

### WR-03: getDemandTimeline has no tenant scope check on the demand

**File:** `backend/src/controllers/demandController.ts:300-319`

**Issue:** `getDemandTimeline` fetches comments and activity entries for a demand by `id` alone (lines 309, 315) without verifying the demand belongs to the requesting user's tenant. Any authenticated user can read another tenant's full demand timeline by providing a known demand UUID.

**Fix:**
```typescript
// Verify ownership before fetching timeline:
const [demand] = await db.select({ id: demandas.id })
  .from(demandas)
  .where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId)));
if (!demand) return res.status(404).json({ error: 'Demand not found' });
// then fetch comments and activities as before
```

### WR-04: addDemandComment has no tenant scope check on the demand

**File:** `backend/src/controllers/demandController.ts:287-298`

**Issue:** `addDemandComment` validates that the calling user has a `tenantId` and `userId`, but does not verify the target demand (identified by the `id` URL parameter) belongs to the user's tenant before inserting the comment (line 295). A user from Tenant A can post comments on Tenant B's demands.

**Fix:**
```typescript
// Before inserting, verify demand ownership:
const [demand] = await db.select({ id: demandas.id })
  .from(demandas)
  .where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId)));
if (!demand) return res.status(404).json({ error: 'Demand not found' });
```

### WR-05: LegislativoEditModal phone mask does not handle 10-digit numbers correctly

**File:** `frontend/src/components/LegislativoEditModal.tsx:113-121`

**Issue:** `applyPhoneMask` handles only 11-digit mobile numbers. The condition `raw.length > 7` is triggered for both 10-digit and 11-digit inputs, always applying the mobile mask `(xx) xxxxx-xxxx`. A 10-digit landline input produces `(xx) xxxxx-xxx` (only 9 digits visible after the DDD) instead of the correct `(xx) xxxx-xxxx`. Combined with `formatPhone.ts` adding a `9` to 10-digit numbers (line 5 of formatPhone.ts), a landline stored as 10 digits gets promoted to a mobile number on the first save.

**Fix:**
```typescript
const applyPhoneMask = (value: string) => {
  const raw = value.replace(/\D/g, '').slice(0, 11);
  let masked = raw;
  if (raw.length > 2) masked = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length === 10) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  if (raw.length === 11) masked = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
  setDisplayPhone(masked);
  const dbNumber = raw.startsWith('55') ? raw : `55${raw}`;
  setMunicipe(prev => ({ ...prev, phone: dbNumber }));
};
```

---

## Info

### IN-01: limit=all hardcoded cap of 10000 may silently truncate data

**File:** `backend/src/controllers/demandController.ts:47`

**Issue:** `listMunicipes` accepts `?limit=all` and converts it to `10000`. If a tenant has more than 10,000 municipes, callers requesting all records receive a truncated result with no indication that pagination was applied. The `totalPages` calculation at line 94 divides by `1` when limit is 10000, making the pagination object appear to indicate a single page of complete results.

**Fix:** Either document the 10,000 cap explicitly in an API response header (`X-Truncated: true`) or replace the `all` shorthand with standard pagination so callers are forced to handle multiple pages.

### IN-02: window.confirm() used for destructive action confirmation

**File:** `frontend/src/pages/Dashboard/FormularioPublico.tsx:202`

**Issue:** `window.confirm()` is used to confirm demand deletion. This is a browser-native blocking dialog that cannot be styled to match the application design, is blocked in some iframe and embedded contexts, and is inconsistent with the rest of the UI which uses toasts and modal dialogs.

**Fix:** Replace with an `AlertDialog` from the existing shadcn/ui component library, which is already used elsewhere in the project and provides a consistent, styleable confirmation flow.

### IN-03: BACKEND_URL derivation is fragile

**File:** `frontend/src/pages/Dashboard/FormularioPublico.tsx:53`

**Issue:** `BACKEND_URL` is derived by calling `.replace('/api', '')` on `VITE_API_URL`. This will silently strip the first occurrence of the substring `/api` wherever it appears in the URL — for example, a URL such as `https://api.example.com/api` would become `https://.example.com/api`, and `https://myapp.com/api/v2` would become `https://myapp.com/v2`. The assumption that `VITE_API_URL` always ends with `/api` is not enforced anywhere.

**Fix:**
```typescript
// Use a dedicated env var instead of deriving:
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
```

---

_Reviewed: 2026-05-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
