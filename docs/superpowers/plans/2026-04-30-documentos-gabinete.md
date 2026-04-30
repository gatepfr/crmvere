# Documentos do Gabinete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a "Documentos" page where the cabinet can register and track formal documents (ofícios, requerimentos, projetos de lei, encaminhamentos formais) with optional citizen linkage.

**Architecture:** New `documentos` table completely separate from `demandas`; new controller + routes on the backend; new page `Documentos.tsx` on the frontend with inline modal; reuses existing municipe search endpoint `/demands/municipes/list`.

**Tech Stack:** TypeScript, Express, Drizzle ORM (drizzle-kit push), PostgreSQL, React, Tailwind CSS, lucide-react, axios (via `api` client)

---

## File Map

| Action | File |
|--------|------|
| Modify | `backend/src/db/schema.ts` |
| Create | `backend/src/controllers/documentoController.ts` |
| Create | `backend/src/routes/documentoRoutes.ts` |
| Modify | `backend/src/app.ts` |
| Create | `frontend/src/pages/Dashboard/Documentos.tsx` |
| Modify | `frontend/src/components/Sidebar.tsx` |
| Modify | `frontend/src/App.tsx` |

---

## Task 1: Schema — Add `documentos` table

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add enums and table to schema**

Open `backend/src/db/schema.ts`. After the last `pgTable` export (after `optouts`) add:

```typescript
export const documentoTipoEnum = pgEnum("documento_tipo", ["oficio", "requerimento", "projeto_lei", "encaminhamento_formal", "outro"]);
export const documentoOrigemEnum = pgEnum("documento_origem", ["gabinete", "municipe"]);
export const documentoStatusEnum = pgEnum("documento_status", ["criado", "enviado", "concluido"]);

export const documentos = pgTable("documentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  municipeId: uuid("municipe_id").references(() => municipes.id, { onDelete: "set null" }),
  tipo: documentoTipoEnum("tipo").notNull(),
  titulo: varchar("titulo", { length: 500 }).notNull(),
  descricao: varchar("descricao", { length: 5000 }),
  origem: documentoOrigemEnum("origem").notNull(),
  status: documentoStatusEnum("status").default("criado").notNull(),
  numeroDocumento: varchar("numero_documento", { length: 50 }),
  documentUrl: varchar("document_url", { length: 500 }),
  criadoPor: uuid("criado_por").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npm run db:migrate
```

Expected output: Drizzle prints the new table being applied. No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat: add documentos table to schema"
```

---

## Task 2: Backend Controller

**Files:**
- Create: `backend/src/controllers/documentoController.ts`

- [ ] **Step 1: Create controller file**

Create `backend/src/controllers/documentoController.ts` with full contents:

```typescript
import type { Request, Response } from 'express';
import { db } from '../db';
import { documentos, municipes } from '../db/schema';
import { eq, and, ilike, desc, count, or } from 'drizzle-orm';

export const listDocumentos = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const tipo = req.query.tipo as string;
  const status = req.query.status as string;
  const origem = req.query.origem as string;
  const offset = (page - 1) * limit;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const conditions: any[] = [eq(documentos.tenantId, tenantId)];
    if (tipo) conditions.push(eq(documentos.tipo, tipo as any));
    if (status) conditions.push(eq(documentos.status, status as any));
    if (origem) conditions.push(eq(documentos.origem, origem as any));
    if (search) {
      conditions.push(or(
        ilike(documentos.titulo, `%${search}%`),
        ilike(municipes.name, `%${search}%`)
      ) as any);
    }

    const [totalCount] = await db
      .select({ count: count() })
      .from(documentos)
      .leftJoin(municipes, eq(documentos.municipeId, municipes.id))
      .where(and(...conditions));

    const results = await db
      .select({
        documento: documentos,
        municipe: { id: municipes.id, name: municipes.name, phone: municipes.phone },
      })
      .from(documentos)
      .leftJoin(municipes, eq(documentos.municipeId, municipes.id))
      .where(and(...conditions))
      .orderBy(desc(documentos.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: results,
      pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / limit) },
    });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const createDocumento = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  if (!tenantId || !userId) return res.status(403).json({ error: 'No tenant context' });
  const { tipo, titulo, descricao, origem, municipeId, numeroDocumento, documentUrl, status } = req.body;
  if (!tipo || !titulo || !origem) return res.status(400).json({ error: 'tipo, titulo e origem são obrigatórios' });
  try {
    const [newDoc] = await db.insert(documentos).values({
      tenantId,
      criadoPor: userId,
      tipo,
      titulo,
      descricao: descricao || null,
      origem,
      municipeId: municipeId || null,
      numeroDocumento: numeroDocumento || null,
      documentUrl: documentUrl || null,
      status: status || 'criado',
    }).returning();
    res.status(201).json(newDoc);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const updateDocumento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const { tipo, titulo, descricao, origem, municipeId, numeroDocumento, documentUrl, status } = req.body;
  try {
    const updateData: any = { updatedAt: new Date() };
    if (tipo !== undefined) updateData.tipo = tipo;
    if (titulo !== undefined) updateData.titulo = titulo;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (origem !== undefined) updateData.origem = origem;
    if (municipeId !== undefined) updateData.municipeId = municipeId || null;
    if (numeroDocumento !== undefined) updateData.numeroDocumento = numeroDocumento;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db.update(documentos).set(updateData)
      .where(and(eq(documentos.id, id), eq(documentos.tenantId, tenantId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Documento não encontrado' });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const deleteDocumento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const [deleted] = await db.delete(documentos)
      .where(and(eq(documentos.id, id), eq(documentos.tenantId, tenantId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Documento não encontrado' });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors related to `documentoController.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/documentoController.ts
git commit -m "feat: add documentoController with CRUD operations"
```

---

## Task 3: Backend Routes + App Registration

**Files:**
- Create: `backend/src/routes/documentoRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create route file**

Create `backend/src/routes/documentoRoutes.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { listDocumentos, createDocumento, updateDocumento, deleteDocumento } from '../controllers/documentoController';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.get('/', listDocumentos);
router.post('/', createDocumento);
router.patch('/:id', updateDocumento);
router.delete('/:id', deleteDocumento);

export default router;
```

- [ ] **Step 2: Register route in app.ts**

In `backend/src/app.ts`, add the import after the last existing import (line 22, after `import reportRoutes`):

```typescript
import documentoRoutes from './routes/documentoRoutes';
```

Then add the route registration after `app.use('/api/reports', reportRoutes);` (line 80):

```typescript
app.use('/api/documentos', documentoRoutes);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Quick smoke test**

Start the backend (`npm run dev`) and test with curl or a REST client:

```bash
# Should return 401 without token (route protected)
curl -s http://localhost:3001/api/documentos
# Expected: {"error":"..."} with status 401
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/documentoRoutes.ts backend/src/app.ts
git commit -m "feat: add documentoRoutes and register in app"
```

---

## Task 4: Frontend Page

**Files:**
- Create: `frontend/src/pages/Dashboard/Documentos.tsx`

- [ ] **Step 1: Create Documentos.tsx**

Create `frontend/src/pages/Dashboard/Documentos.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { Plus, Search, Loader2, Edit2, Trash2, X, ExternalLink, File } from 'lucide-react';

interface MunicipeResult { id: string; name: string; phone: string; bairro: string | null; }

interface Documento {
  documento: {
    id: string;
    tipo: string;
    titulo: string;
    descricao: string | null;
    origem: string;
    status: string;
    numeroDocumento: string | null;
    documentUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
  municipe: { id: string; name: string; phone: string } | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const TIPO_LABELS: Record<string, string> = {
  oficio: 'Ofício',
  requerimento: 'Requerimento',
  projeto_lei: 'Projeto de Lei',
  encaminhamento_formal: 'Encaminhamento Formal',
  outro: 'Outro',
};

const TIPO_COLORS: Record<string, string> = {
  oficio: 'bg-blue-100 text-blue-700',
  requerimento: 'bg-purple-100 text-purple-700',
  projeto_lei: 'bg-emerald-100 text-emerald-700',
  encaminhamento_formal: 'bg-amber-100 text-amber-700',
  outro: 'bg-slate-100 text-slate-600',
};

const STATUS_COLORS: Record<string, string> = {
  criado: 'bg-slate-100 text-slate-600',
  enviado: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<string, string> = {
  criado: 'Criado',
  enviado: 'Enviado',
  concluido: 'Concluído',
};

const emptyForm = {
  tipo: 'oficio',
  titulo: '',
  descricao: '',
  origem: 'gabinete',
  municipeId: '',
  municipeName: '',
  numeroDocumento: '',
  documentUrl: '',
  status: 'criado',
};

export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Documento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [municipeSearch, setMunicipeSearch] = useState('');
  const [municipeResults, setMunicipeResults] = useState<MunicipeResult[]>([]);
  const [searchingMunicipe, setSearchingMunicipe] = useState(false);

  const fetchDocs = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      search,
      ...(filterTipo && { tipo: filterTipo }),
      ...(filterStatus && { status: filterStatus }),
      ...(filterOrigem && { origem: filterOrigem }),
    });
    api.get(`/documentos?${params}`)
      .then(res => {
        setDocs(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
      })
      .catch(err => console.error(err))
      .finally(() => { if (!isBackground) setLoading(false); });
  }, [pagination.page, search, filterTipo, filterStatus, filterOrigem]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleMunicipeSearch = async (term: string) => {
    setMunicipeSearch(term);
    setForm(f => ({ ...f, municipeId: '', municipeName: '' }));
    if (term.length < 3) { setMunicipeResults([]); return; }
    setSearchingMunicipe(true);
    try {
      const res = await api.get(`/demands/municipes/list?search=${term}&limit=5`);
      setMunicipeResults(res.data.data || []);
    } catch { setMunicipeResults([]); }
    finally { setSearchingMunicipe(false); }
  };

  const selectMunicipe = (m: MunicipeResult) => {
    setForm(f => ({ ...f, municipeId: m.id, municipeName: m.name }));
    setMunicipeSearch(m.name);
    setMunicipeResults([]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setMunicipeSearch('');
    setMunicipeResults([]);
    setModalOpen(true);
  };

  const openEdit = (d: Documento) => {
    setEditing(d);
    setForm({
      tipo: d.documento.tipo,
      titulo: d.documento.titulo,
      descricao: d.documento.descricao || '',
      origem: d.documento.origem,
      municipeId: d.municipe?.id || '',
      municipeName: d.municipe?.name || '',
      numeroDocumento: d.documento.numeroDocumento || '',
      documentUrl: d.documento.documentUrl || '',
      status: d.documento.status,
    });
    setMunicipeSearch(d.municipe?.name || '');
    setMunicipeResults([]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { alert('Título é obrigatório'); return; }
    if (form.origem === 'municipe' && !form.municipeId) { alert('Selecione um munícipe'); return; }
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        titulo: form.titulo,
        descricao: form.descricao || null,
        origem: form.origem,
        municipeId: form.origem === 'municipe' ? form.municipeId : null,
        numeroDocumento: form.numeroDocumento || null,
        documentUrl: form.documentUrl || null,
        status: form.status,
      };
      if (editing) {
        await api.patch(`/documentos/${editing.documento.id}`, payload);
      } else {
        await api.post('/documentos', payload);
      }
      setModalOpen(false);
      fetchDocs();
    } catch { alert('Erro ao salvar documento'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este documento?')) return;
    try {
      await api.delete(`/documentos/${id}`);
      fetchDocs();
    } catch { alert('Erro ao excluir'); }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Documentos do Gabinete</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Ofícios, Requerimentos e mais</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
          <Plus size={18} /> NOVO DOCUMENTO
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar por título ou munícipe..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
          />
        </div>
        <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">Todos os status</option>
          <option value="criado">Criado</option>
          <option value="enviado">Enviado</option>
          <option value="concluido">Concluído</option>
        </select>
        <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" value={filterOrigem} onChange={e => { setFilterOrigem(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">Todas as origens</option>
          <option value="gabinete">Gabinete</option>
          <option value="municipe">Munícipe</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <File size={40} className="mb-3 opacity-30" />
            <p className="font-bold text-sm uppercase tracking-widest">Nenhum documento encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Tipo', 'Título', 'Munícipe', 'Nº / Link', 'Status', 'Data', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(({ documento: d, municipe }) => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${TIPO_COLORS[d.tipo] || 'bg-slate-100 text-slate-600'}`}>
                      {TIPO_LABELS[d.tipo] || d.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 max-w-xs truncate">{d.titulo}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{municipe?.name || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {d.numeroDocumento && <span className="text-xs font-bold text-slate-700">{d.numeroDocumento}</span>}
                      {d.documentUrl && (
                        <a href={d.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <ExternalLink size={10} /> Ver doc
                        </a>
                      )}
                      {!d.numeroDocumento && !d.documentUrl && <span className="text-slate-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[d.status] || d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit({ documento: d, municipe })} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400 font-medium">{pagination.total} documentos</span>
          <div className="flex gap-2">
            <button disabled={pagination.page === 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold disabled:opacity-40 hover:bg-slate-50 transition-colors">←</button>
            <span className="px-3 py-1.5 font-bold text-slate-600">{pagination.page} / {pagination.totalPages}</span>
            <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold disabled:opacity-40 hover:bg-slate-50 transition-colors">→</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-900">{editing ? 'Editar Documento' : 'Novo Documento'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18} className="text-slate-500" /></button>
            </div>
            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Tipo */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo *</label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {/* Título */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Título *</label>
                <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Assunto do documento"
                  value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                <textarea className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3} placeholder="Detalhes adicionais (opcional)"
                  value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              {/* Origem */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Origem *</label>
                <div className="flex gap-4">
                  {[{ v: 'gabinete', l: 'Gabinete' }, { v: 'municipe', l: 'Munícipe' }].map(({ v, l }) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="origem" value={v} checked={form.origem === v}
                        onChange={() => setForm(f => ({ ...f, origem: v, municipeId: '', municipeName: '' }))} />
                      <span className="text-sm font-medium text-slate-700">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Munícipe (conditional) */}
              {form.origem === 'municipe' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Munícipe *</label>
                  <div className="relative">
                    <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Buscar por nome ou telefone..."
                      value={municipeSearch}
                      onChange={e => handleMunicipeSearch(e.target.value)} />
                    {searchingMunicipe && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />}
                    {municipeResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                        {municipeResults.map(m => (
                          <button key={m.id} onClick={() => selectMunicipe(m)}
                            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0">
                            <span className="font-semibold text-slate-800">{m.name}</span>
                            {m.bairro && <span className="text-slate-400 ml-2 text-xs">{m.bairro}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.municipeId && <p className="text-xs text-green-600 font-medium">✓ {form.municipeName} selecionado</p>}
                </div>
              )}
              {/* Nº Protocolo */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nº Protocolo</label>
                <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 001/2026 (opcional)"
                  value={form.numeroDocumento} onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))} />
              </div>
              {/* Link */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Link do Documento</label>
                <input className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://drive.google.com/... (opcional)"
                  value={form.documentUrl} onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))} />
              </div>
              {/* Status */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="criado">Criado</option>
                  <option value="enviado">Enviado</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            </div>
            <div className="px-8 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/Documentos.tsx
git commit -m "feat: add Documentos page with list, filters, and create/edit modal"
```

---

## Task 5: Frontend Navigation

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add icon import to Sidebar.tsx**

In `frontend/src/components/Sidebar.tsx`, the `FileText` icon is already imported but used for Prestação de Contas. Import `File` as a distinct icon for Documentos. Find the lucide-react import block and add `File`:

```typescript
// Change this line (find the existing lucide-react import):
import {
  // ...existing icons...
  FileText,
  // add:
  File,
  // ...rest...
} from 'lucide-react';
```

- [ ] **Step 2: Add nav item to Sidebar**

In `frontend/src/components/Sidebar.tsx`, find the `Atendimento` group items array:

```typescript
items: [
  { name: 'Atendimento On Line', icon: MessageSquare, path: '/dashboard/demands' },
  { name: 'Indicações', icon: ClipboardList, path: '/dashboard/legislativo' },
  // ADD HERE:
  { name: 'Documentos', icon: File, path: '/dashboard/documentos' },
  { name: 'Munícipes', icon: Users, path: '/dashboard/municipes' },
  { name: 'Mapa de Demandas', icon: Map, path: '/dashboard/map' },
  { name: 'Funil de Leads', icon: KanbanIcon, path: '/dashboard/kanban' },
],
```

- [ ] **Step 3: Add import and route to App.tsx**

In `frontend/src/App.tsx`, add the import after the `Legislativo` import (line 9):

```typescript
import Documentos from './pages/Dashboard/Documentos';
```

Then add the route after `<Route path="legislativo" element={<Legislativo />} />` (line 100):

```typescript
<Route path="documentos" element={<Documentos />} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat: add Documentos to sidebar navigation and router"
```

---

## Task 6: End-to-End Verification

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Verify navigation**

Open browser at `http://localhost:5173`. Log in. Confirm "Documentos" appears in the sidebar under "Atendimento", between "Indicações" and "Munícipes".

- [ ] **Step 3: Test create — sem munícipe**

Click "+ Novo Documento". Select tipo "Ofício", fill title "Teste de ofício", origem "Gabinete", status "Criado". Click "Criar". Confirm item appears in the list.

- [ ] **Step 4: Test create — com munícipe**

Click "+ Novo Documento". Select tipo "Requerimento", origem "Munícipe". Type at least 3 characters in the municipe field and confirm the dropdown appears with results. Select one. Fill title and save. Confirm the municipe name appears in the list row.

- [ ] **Step 5: Test edit**

Click the edit icon on a document. Change the status to "Enviado". Save. Confirm badge updates in the list.

- [ ] **Step 6: Test delete**

Click the delete icon. Confirm the confirmation dialog. Confirm item disappears from the list.

- [ ] **Step 7: Test filters**

Use the "Tipo" filter. Confirm the list filters correctly. Clear filter. Use "Status" filter. Confirm filtering works.

- [ ] **Step 8: Confirm Indicações still works**

Navigate to Indicações page. Confirm it loads normally and no functionality is broken.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: página Documentos do Gabinete completa"
```
