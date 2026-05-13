# Página Pública de Demandas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma página pública por tenant (`/p/:slug`) onde cidadãos enviam demandas sem login, que caem no CRM, com upsert de munícipe e confirmação via WhatsApp.

**Architecture:** Rota pública `/p/:slug` no React existente sem `ProtectedRoute`. Backend recebe a demanda em dois endpoints sem `authenticate` middleware, registrados antes do `app.use(authenticate)` em `app.ts`. A demanda é gravada com colunas novas na tabela `demandas` (origem, localizacao, fotoUrl, protocolo).

**Tech Stack:** Express 5, Drizzle ORM, React Router, Tailwind, axios, multer (já instalado), express-rate-limit (instalar), OpenStreetMap Nominatim (geocoding gratuito, sem chave).

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/src/db/schema.ts` | Modificar | Adicionar 4 colunas em `demandas` |
| `backend/drizzle/XXXX_public_demand.sql` | Gerado | Migration SQL auto-gerada pelo drizzle-kit |
| `backend/src/controllers/publicController.ts` | Criar | Handlers `getTenantPublicInfo` e `submitPublicDemand` |
| `backend/src/controllers/__tests__/publicController.test.ts` | Criar | Testes dos dois handlers |
| `backend/src/routes/publicRoutes.ts` | Criar | Rotas públicas com rate-limit e multer |
| `backend/src/app.ts` | Modificar | Registrar publicRoutes antes de `authenticate` |
| `frontend/public/icone_foguete.png` | Copiar | Asset de fallback do avatar |
| `frontend/src/pages/Public/PublicDemandPage.tsx` | Criar | Formulário público completo |
| `frontend/src/App.tsx` | Modificar | Adicionar rota `/p/:slug` pública |

---

## Task 1: Adicionar colunas na tabela demandas

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Abrir `backend/src/db/schema.ts` e localizar a tabela `demandas` (linha ~135)**

- [ ] **Step 2: Adicionar as 4 colunas novas logo antes do campo `createdAt`**

Localizar este trecho:
```typescript
  closedAt: timestamp("closed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
```

Substituir por:
```typescript
  closedAt: timestamp("closed_at"),

  // Formulário público
  origem: varchar("origem", { length: 50 }),           // "formulario_publico" | "whatsapp" | "instagram" | "manual"
  localizacao: varchar("localizacao", { length: 500 }),
  fotoUrl: varchar("foto_url", { length: 500 }),
  protocolo: varchar("protocolo", { length: 20 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
```

- [ ] **Step 3: Gerar a migration (dentro da pasta `backend/`)**

```bash
cd backend && npx drizzle-kit generate
```

Esperado: arquivo `drizzle/XXXX_public_demand.sql` criado com os 4 `ALTER TABLE`.

- [ ] **Step 4: Aplicar a migration no banco**

```bash
npx drizzle-kit migrate
```

Esperado: `[✓] Migrations applied successfully`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "feat(db): add origem, localizacao, fotoUrl, protocolo to demandas"
```

---

## Task 2: Criar publicController.ts

**Files:**
- Create: `backend/src/controllers/publicController.ts`

- [ ] **Step 1: Criar o arquivo com os dois handlers**

```typescript
// backend/src/controllers/publicController.ts
import type { Request, Response } from 'express';
import { db } from '../db';
import {
  tenants, municipes, demandas, demandCategories, globalCategories
} from '../db/schema';
import { eq, and, count, sql, asc } from 'drizzle-orm';
import { normalizePhone } from '../utils/phoneUtils';
import { EvolutionService } from '../services/evolutionService';
import fs from 'fs';
import path from 'path';

// GET /api/public/tenant/:slug
export const getTenantPublicInfo = async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        municipio: tenants.municipio,
        uf: tenants.uf,
        partido: tenants.partido,
        mandato: tenants.mandato,
        fotoUrl: tenants.fotoUrl,
        active: tenants.active,
        blocked: tenants.blocked,
      })
      .from(tenants)
      .where(eq(tenants.slug, slug));

    if (!tenant || !tenant.active || tenant.blocked) {
      return res.status(404).json({ error: 'Gabinete não encontrado' });
    }

    const tenantCats = await db
      .select({ id: demandCategories.id, name: demandCategories.name, icon: demandCategories.icon, color: demandCategories.color })
      .from(demandCategories)
      .where(eq(demandCategories.tenantId, tenant.id))
      .orderBy(asc(demandCategories.name));

    const categories = tenantCats.length > 0
      ? tenantCats
      : await db
          .select({ id: globalCategories.id, name: globalCategories.name, icon: globalCategories.icon, color: globalCategories.color })
          .from(globalCategories)
          .orderBy(asc(globalCategories.order));

    return res.json({
      name: tenant.name,
      municipio: tenant.municipio,
      uf: tenant.uf,
      partido: tenant.partido,
      mandato: tenant.mandato,
      fotoUrl: tenant.fotoUrl,
      categories,
    });
  } catch (err) {
    console.error('[PUBLIC] getTenantPublicInfo error', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
};

// POST /api/public/demanda/:slug
export const submitPublicDemand = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { categoriaId, descricao, localizacao, nome, telefone } = req.body;
  const fotoFile = req.file as Express.Multer.File | undefined;

  if (!categoriaId || !descricao || !nome || !telefone) {
    return res.status(400).json({ error: 'Campos obrigatórios: categoriaId, descricao, nome, telefone' });
  }
  if (descricao.length < 10) {
    return res.status(400).json({ error: 'Descrição deve ter ao menos 10 caracteres' });
  }

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    if (!tenant || !tenant.active || tenant.blocked) {
      return res.status(404).json({ error: 'Gabinete não encontrado' });
    }

    // Resolve category name from ID
    let categoriaNome = 'Outros';
    const [tenantCat] = await db
      .select({ name: demandCategories.name })
      .from(demandCategories)
      .where(and(eq(demandCategories.id, categoriaId), eq(demandCategories.tenantId, tenant.id)));
    if (tenantCat) {
      categoriaNome = tenantCat.name;
    } else {
      const [globalCat] = await db
        .select({ name: globalCategories.name })
        .from(globalCategories)
        .where(eq(globalCategories.id, categoriaId));
      if (globalCat) categoriaNome = globalCat.name;
    }

    // Normalize phone
    const phoneNormalized = normalizePhone(telefone);

    // Upsert municipe
    let municipeId: string;
    const [existing] = await db
      .select({ id: municipes.id })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenant.id), eq(municipes.phone, phoneNormalized)));

    if (existing) {
      municipeId = existing.id;
    } else {
      const [newMunicipe] = await db
        .insert(municipes)
        .values({ tenantId: tenant.id, name: nome, phone: phoneNormalized })
        .returning({ id: municipes.id });
      municipeId = newMunicipe.id;
    }

    // Handle photo upload
    let fotoUrl: string | null = null;
    if (fotoFile) {
      const ext = (fotoFile.originalname.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `demanda-${Date.now()}.${ext}`;
      const destDir = path.join('uploads', 'demandas');
      fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(fotoFile.path, path.join(destDir, fileName));
      fotoUrl = `/uploads/demandas/${fileName}`;
    }

    // Generate protocolo: YYYY-NNNN (sequential per tenant per year)
    const year = new Date().getFullYear();
    const [{ total }] = await db
      .select({ total: count() })
      .from(demandas)
      .where(and(
        eq(demandas.tenantId, tenant.id),
        sql`EXTRACT(YEAR FROM ${demandas.createdAt}) = ${year}`
      ));
    const protocolo = `${year}-${String(Number(total) + 1).padStart(4, '0')}`;

    // Create demand
    await db.insert(demandas).values({
      tenantId: tenant.id,
      municipeId,
      categoria: categoriaNome,
      descricao,
      localizacao: localizacao || null,
      fotoUrl,
      origem: 'formulario_publico',
      protocolo,
      status: 'nova',
      prioridade: 'media',
    });

    // Fire-and-forget WhatsApp messages
    if (tenant.whatsappInstanceId && tenant.evolutionApiUrl && tenant.evolutionGlobalToken) {
      const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
      const localStr = localizacao ? `\n📍 *Local:* ${localizacao}` : '';
      const cidadaoMsg =
        `✅ *Demanda recebida!*\n\nOlá, ${nome}! Sua demanda foi registrada com sucesso no gabinete do ${tenant.name}.\n\n📋 *Protocolo:* #${protocolo}\n📌 *Categoria:* ${categoriaNome}${localStr}\n\nO vereador vai dar andamento o mais breve possível. Obrigado pelo contato!`;
      evo.sendMessage(tenant.whatsappInstanceId, phoneNormalized, cidadaoMsg).catch(() => {});

      if (tenant.whatsappNotificationNumber) {
        const preview = descricao.length > 100 ? descricao.slice(0, 100) + '...' : descricao;
        const teamMsg =
          `🔔 *Nova demanda via formulário público!*\n\n👤 ${nome} — 📱 ${telefone}\n📌 ${categoriaNome}${localizacao ? ` — 📍 ${localizacao}` : ''}\n📝 ${preview}\n\nAcesse o CRM para visualizar e atribuir.`;
        evo.sendMessage(tenant.whatsappInstanceId, tenant.whatsappNotificationNumber, teamMsg).catch(() => {});
      }
    }

    return res.status(201).json({ protocolo, message: 'Demanda recebida com sucesso!' });
  } catch (err) {
    console.error('[PUBLIC] submitPublicDemand error', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/publicController.ts
git commit -m "feat(backend): add publicController with getTenantPublicInfo and submitPublicDemand"
```

---

## Task 3: Testes do publicController

**Files:**
- Create: `backend/src/controllers/__tests__/publicController.test.ts`

- [ ] **Step 1: Criar o arquivo de testes**

```typescript
// backend/src/controllers/__tests__/publicController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantPublicInfo, submitPublicDemand } from '../publicController';
import { db } from '../../db';

vi.mock('../../db');
vi.mock('../../services/evolutionService', () => ({
  EvolutionService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue({}),
  })),
}));

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('getTenantPublicInfo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 404 para slug inexistente', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue([]) }),
    });
    const req = { params: { slug: 'inexistente' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 404 para tenant bloqueado', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ id: 'uuid-1', name: 'Vereador X', active: true, blocked: true }]),
      }),
    });
    const req = { params: { slug: 'bloqueado' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('submitPublicDemand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando campos obrigatórios faltam', async () => {
    const req = {
      params: { slug: 'valdirsanta' },
      body: { categoriaId: 'cat-1', descricao: 'Buraco', nome: 'João' }, // falta telefone
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('retorna 400 quando descrição é curta demais', async () => {
    const req = {
      params: { slug: 'valdirsanta' },
      body: { categoriaId: 'cat-1', descricao: 'Curto', nome: 'João', telefone: '43999990000' },
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 404 quando tenant não existe', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue([]) }),
    });
    const req = {
      params: { slug: 'naoexiste' },
      body: { categoriaId: 'cat-1', descricao: 'Descrição longa o suficiente', nome: 'João', telefone: '43999990000' },
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 2: Rodar os testes**

```bash
cd backend && npx vitest run src/controllers/__tests__/publicController.test.ts
```

Esperado: todos os testes passando (PASS).

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/__tests__/publicController.test.ts
git commit -m "test(backend): add publicController tests"
```

---

## Task 4: Criar publicRoutes.ts e registrar em app.ts

**Files:**
- Create: `backend/src/routes/publicRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Instalar express-rate-limit**

```bash
cd backend && npm install express-rate-limit
```

Esperado: `added 1 package`.

- [ ] **Step 2: Criar `backend/src/routes/publicRoutes.ts`**

```typescript
// backend/src/routes/publicRoutes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { getTenantPublicInfo, submitPublicDemand } from '../controllers/publicController';

const router = Router();

const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: { error: 'Muitas tentativas. Tente novamente em uma hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/tenant/:slug', getTenantPublicInfo);
router.post('/demanda/:slug', submitLimiter, upload.single('foto'), submitPublicDemand);

export default router;
```

- [ ] **Step 3: Registrar em `backend/src/app.ts` antes de `app.use(authenticate)`**

Localizar este trecho em `app.ts`:
```typescript
import instagramOAuthRoutes from './routes/instagramOAuthRoutes';
import { authenticate } from './middleware/auth';
```

Substituir por:
```typescript
import instagramOAuthRoutes from './routes/instagramOAuthRoutes';
import publicRoutes from './routes/publicRoutes';
import { authenticate } from './middleware/auth';
```

Depois, localizar:
```typescript
// Instagram OAuth routes (callback is public; auth applied internally after callback)
app.use('/api/instagram', instagramOAuthRoutes);

// 3. PROTECTED ROUTES (Require Login)
app.use(authenticate);
```

Substituir por:
```typescript
// Instagram OAuth routes (callback is public; auth applied internally after callback)
app.use('/api/instagram', instagramOAuthRoutes);

// 3. PUBLIC ROUTES (No auth required)
app.use('/api/public', publicRoutes);

// 4. PROTECTED ROUTES (Require Login)
app.use(authenticate);
```

- [ ] **Step 4: Testar os endpoints manualmente**

```bash
# Terminal 1 — subir o backend
cd backend && npm run dev

# Terminal 2 — testar GET
curl http://localhost:3001/api/public/tenant/SEU_SLUG_AQUI

# Testar POST com validação
curl -X POST http://localhost:3001/api/public/demanda/SEU_SLUG_AQUI \
  -F "categoriaId=ID_CATEGORIA" \
  -F "descricao=Teste de demanda pública funcionando" \
  -F "nome=João Silva" \
  -F "telefone=43999990000"
```

Esperado no GET: JSON com `name`, `categories`, etc.
Esperado no POST: `{ "protocolo": "2026-0001", "message": "Demanda recebida com sucesso!" }`

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/publicRoutes.ts backend/src/app.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add public routes with rate limiting and multer"
```

---

## Task 5: Copiar asset e criar PublicDemandPage.tsx

**Files:**
- Copy: `icone_foguete.png` → `frontend/public/icone_foguete.png`
- Create: `frontend/src/pages/Public/PublicDemandPage.tsx`

- [ ] **Step 1: Copiar o icone_foguete.png para o public do frontend**

```bash
cp icone_foguete.png frontend/public/icone_foguete.png
```

Verificar: `ls frontend/public/icone_foguete.png` deve existir.

- [ ] **Step 2: Criar `frontend/src/pages/Public/PublicDemandPage.tsx`**

```tsx
// frontend/src/pages/Public/PublicDemandPage.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../api/client';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface TenantInfo {
  name: string;
  municipio: string | null;
  uf: string | null;
  partido: string | null;
  fotoUrl: string | null;
  categories: Category[];
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PublicDemandPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [categoriaId, setCategoriaId] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/tenant/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setTenant)
      .catch(() => setNotFound(true));
  }, [slug]);

  const handleGps = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await r.json();
          const addr = data.address;
          const parts = [addr.road, addr.house_number, addr.suburb || addr.neighbourhood, addr.city || addr.town].filter(Boolean);
          setLocalizacao(parts.join(', '));
        } catch {
          setLocalizacao(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        } finally {
          setGpsLoading(false);
        }
      },
      () => setGpsLoading(false)
    );
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!categoriaId) { setError('Selecione o tipo de demanda.'); return; }
    if (descricao.length < 10) { setError('Descreva o problema com ao menos 10 caracteres.'); return; }

    setSubmitting(true);
    const form = new FormData();
    form.append('categoriaId', categoriaId);
    form.append('descricao', descricao);
    form.append('nome', nome);
    form.append('telefone', telefone.replace(/\D/g, ''));
    if (localizacao) form.append('localizacao', localizacao);
    if (foto) form.append('foto', foto);

    try {
      const r = await fetch(`${API_BASE_URL}/public/demanda/${slug}`, { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Erro ao enviar.'); return; }
      setProtocolo(data.protocolo);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow">
          <p className="text-4xl mb-4">🏛️</p>
          <h1 className="text-lg font-bold text-slate-800">Gabinete não encontrado</h1>
          <p className="text-sm text-slate-500 mt-2">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (protocolo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a3b] to-[#2d1b69] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-sm shadow-2xl w-full">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-xl font-extrabold text-slate-800 mb-2">Demanda enviada!</h1>
          <p className="text-sm text-slate-500 mb-4">Seu protocolo é</p>
          <div className="bg-purple-50 border border-purple-200 rounded-xl py-3 px-6 inline-block mb-4">
            <span className="font-mono font-bold text-purple-700 text-lg">#{protocolo}</span>
          </div>
          <p className="text-sm text-slate-500">
            Você receberá a confirmação pelo <span className="text-green-600 font-semibold">WhatsApp</span>.
            O vereador vai dar andamento em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1a0a3b] to-[#2d1b69] px-4 py-6 text-center text-white">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden border-2 border-yellow-400/50 bg-[#1a0a3b] flex items-center justify-center">
          {tenant.fotoUrl
            ? <img src={tenant.fotoUrl} alt={tenant.name} className="w-full h-full object-cover" />
            : <img src="/icone_foguete.png" alt="CRM do Verê" className="w-10 h-10 object-contain" />
          }
        </div>
        <h1 className="font-extrabold text-base leading-tight">{tenant.name}</h1>
        <p className="text-xs opacity-75 mt-1">
          {[tenant.municipio, tenant.uf, tenant.partido].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 space-y-5 pb-10">

        {/* Categories */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tipo de demanda *</p>
          <div className="grid grid-cols-3 gap-2">
            {tenant.categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaId(cat.id)}
                className={`rounded-xl p-2 text-center border-2 transition-all ${
                  categoriaId === cat.id
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span className="block text-xl mb-1">{cat.icon || '📌'}</span>
                <span className="text-[10px] font-semibold leading-tight block">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Localização</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={localizacao}
              onChange={e => setLocalizacao(e.target.value)}
              placeholder="Endereço ou bairro..."
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleGps}
              disabled={gpsLoading}
              className="bg-purple-600 text-white rounded-xl px-3 py-2.5 text-lg shrink-0 disabled:opacity-50"
              title="Usar minha localização"
            >
              {gpsLoading ? '⏳' : '📍'}
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Descrição *</p>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva o problema com detalhes..."
            rows={3}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Photo */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Foto (opcional)</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFoto} />
          {fotoPreview
            ? (
              <div className="relative">
                <img src={fotoPreview} alt="preview" className="w-full h-32 object-cover rounded-xl" />
                <button type="button" onClick={() => { setFoto(null); setFotoPreview(null); }}
                  className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 text-xs shadow flex items-center justify-center">✕</button>
              </div>
            )
            : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl py-4 text-center text-sm text-slate-400 bg-white">
                <span className="block text-2xl mb-1">📷</span>
                Toque para adicionar foto
              </button>
            )
          }
        </div>

        {/* Personal data */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Seus dados</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Seu nome"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
            />
            <input
              type="tel"
              value={telefone}
              onChange={handlePhone}
              placeholder="(43) 99999-9999"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-700 to-[#2d1b69] text-white font-extrabold rounded-2xl py-4 text-sm disabled:opacity-60"
        >
          {submitting ? 'Enviando...' : '📤 Enviar Demanda'}
        </button>

        <p className="text-center text-xs text-slate-400">
          Você receberá confirmação pelo <span className="text-green-600 font-semibold">WhatsApp</span>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/public/icone_foguete.png frontend/src/pages/Public/PublicDemandPage.tsx
git commit -m "feat(frontend): add PublicDemandPage with GPS, photo upload and phone mask"
```

---

## Task 6: Registrar rota pública no App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Adicionar import do componente**

Em `frontend/src/App.tsx`, localizar o bloco de imports das páginas (após linha `import Broadcasts`):
```typescript
import Reports from './pages/Dashboard/Reports';
```

Adicionar logo depois:
```typescript
import PublicDemandPage from './pages/Public/PublicDemandPage';
```

- [ ] **Step 2: Adicionar a rota antes do ProtectedRoute**

Localizar em `AppContent`:
```tsx
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
```

Adicionar a rota pública logo depois:
```tsx
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/p/:slug" element={<PublicDemandPage />} />
```

- [ ] **Step 3: Rodar o frontend e testar**

```bash
cd frontend && npm run dev
```

Abrir `http://localhost:5173/p/SEU_SLUG_AQUI` no browser.

Verificar:
- Cabeçalho com foto do vereador ou foguete
- Grid de categorias carregado da API
- Botão GPS preenchendo o campo de endereço
- Campo de telefone formatando com máscara `(XX) XXXXX-XXXX`
- Upload de foto com preview
- Envio retornando tela de sucesso com protocolo

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): add public route /p/:slug for PublicDemandPage"
```

---

## Task 7: Badge de origem no CRM (demandas)

**Files:**
- Modify: `frontend/src/pages/Dashboard/Demands.tsx`

- [ ] **Step 1: Localizar onde a demanda é exibida na lista**

```bash
grep -n "categoria\|municipe\|status" frontend/src/pages/Dashboard/Demands.tsx | head -20
```

- [ ] **Step 2: Adicionar badge "Via Formulário" quando `origem === 'formulario_publico'`**

Localizar onde o status/categoria da demanda é renderizado na listagem. Adicionar ao lado do status:

```tsx
{demand.origem === 'formulario_publico' && (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5">
    📋 Formulário
  </span>
)}
```

> **Nota:** a propriedade `origem` pode não estar na tipagem atual. Se necessário, adicionar `origem?: string` ao tipo da demanda no componente.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard/Demands.tsx
git commit -m "feat(frontend): show 'Via Formulário' badge on demands from public form"
```

---

## Task 8: Push e validação final

- [ ] **Step 1: Rodar todos os testes do backend**

```bash
cd backend && npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 2: Build do frontend sem erros**

```bash
cd frontend && npm run build
```

Esperado: build sem erros TypeScript.

- [ ] **Step 3: Push para o GitHub**

```bash
rtk git push
```

- [ ] **Step 4: Pull no servidor e verificar**

No servidor:
```bash
git pull
docker compose up -d --build backend frontend
```

Testar `https://app.crmvere.com.br/p/SEU_SLUG` no celular.
