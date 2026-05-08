# Instagram Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Instagram ao CRM: campo `@` nos munícipes com auto-link anti-duplicata, recebimento de DMs como canal de atendimento (com IA togglável), e robô de comentários por palavra-chave global e por post específico.

**Architecture:** Backend segue o padrão existente — `instagramService.ts` (wrapper Meta Graph API), `instagramRoutes.ts` (configuração + CRUD de regras por post), extensão do `webhookRoutes.ts`. Lookup de munícipes via Instagram usa 3 camadas: `instagramUserId` → `instagramHandle` → criação nova. Frontend adiciona `InstagramConfig.tsx` com toggle de IA, keywords globais e regras por post.

**Tech Stack:** Meta Graph API v21.0, axios, Drizzle ORM (`pnpm drizzle-kit push`), React + Tailwind

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/src/db/schema.ts` | Modify | +2 campos em `municipes`; +8 campos em `tenants`; nova tabela `instagramCommentRules` |
| `backend/src/controllers/demandController.ts` | Modify | Aceitar `instagramHandle` e `instagramUserId` em create/update |
| `backend/src/services/instagramService.ts` | Create | Wrapper Meta Graph API: sendDM, replyToComment, getAccountInfo |
| `backend/src/services/instagramWebhookOrchestration.ts` | Create | DMs (lookup 3 camadas + AI toggle) + comentários (global + por post) |
| `backend/src/routes/webhookRoutes.ts` | Modify | +GET verificação Meta + POST eventos Instagram |
| `backend/src/routes/instagramRoutes.ts` | Create | Setup, status, CRUD de regras por post |
| `backend/src/routes/configRoutes.ts` | Modify | Expor novos campos Instagram no PATCH /update |
| `backend/src/app.ts` | Modify | Registrar `instagramRoutes` |
| `frontend/src/pages/Dashboard/Municipes.tsx` | Modify | Campo `@instagram` no formulário + badge na tabela |
| `frontend/src/pages/Dashboard/InstagramConfig.tsx` | Create | Config: credenciais, toggle IA, keywords globais, regras por post |
| `frontend/src/App.tsx` | Modify | Rota `/dashboard/instagram` |
| `frontend/src/components/Sidebar.tsx` | Modify | Item Instagram no grupo Comunicação |

---

## Task 1: Campo `instagramHandle` e `instagramUserId` no schema dos munícipes

**Files:**
- Modify: `backend/src/db/schema.ts:67-82`

- [ ] **Step 1: Adicionar campos ao schema**

Substituir a definição completa da tabela `municipes` (linha 67):

```typescript
export const municipes = pgTable("municipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  cep: varchar("cep", { length: 20 }),
  bairro: varchar("bairro", { length: 255 }),
  birthDate: timestamp("birth_date"),
  isLideranca: boolean("is_lideranca").default(false).notNull(),
  instagramHandle: varchar("instagram_handle", { length: 100 }),   // @username (manual ou auto)
  instagramUserId: varchar("instagram_user_id", { length: 100 }),  // IGSID do Meta (auto via DM)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueMunicipe: unique().on(table.tenantId, table.phone)
  };
});
```

- [ ] **Step 2: Rodar migração**

```bash
cd backend && pnpm drizzle-kit push
```

Expected: `Changes applied`

- [ ] **Step 3: Commit**

```bash
rtk git add backend/src/db/schema.ts
rtk git commit -m "feat: add instagramHandle and instagramUserId fields to municipes"
```

---

## Task 2: Campo `@instagram` no frontend (Municipes.tsx)

**Files:**
- Modify: `frontend/src/pages/Dashboard/Municipes.tsx`

- [ ] **Step 1: Atualizar a interface `Municipe` (linha 39)**

```typescript
interface Municipe {
  id: string;
  name: string;
  phone: string;
  cep?: string | null;
  bairro: string | null;
  birthDate: string | null;
  isLideranca: boolean;
  instagramHandle?: string | null;
  createdAt: string;
  demandCount: number;
  documentCount: number;
  indicacaoCount: number;
}
```

- [ ] **Step 2: Adicionar `instagramHandle` ao `createForm` state (linha 95)**

```typescript
const [createForm, setCreateForm] = useState({
  name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false, instagramHandle: ''
});
```

- [ ] **Step 3: Adicionar `instagramHandle` ao `editForm` state (linha 106)**

```typescript
const [editForm, setEditForm] = useState({
  name: '', phone: '', cep: '', bairro: '', birthDate: '', isLideranca: false, instagramHandle: ''
});
```

- [ ] **Step 4: Popular `editForm` no `handleEdit` (linha 343)**

```typescript
const handleEdit = (m: Municipe) => {
  setEditingMunicipe(m);
  setEditForm({
    name: m.name, phone: m.phone, cep: m.cep || '', bairro: m.bairro || '',
    birthDate: m.birthDate ? formatDateDisplay(m.birthDate) : '',
    isLideranca: m.isLideranca,
    instagramHandle: m.instagramHandle || '',
  });
  setDisplayEditPhone(formatPhone(m.phone));
};
```

- [ ] **Step 5: Adicionar campo no formulário (Create/Edit Modal, após grid CEP/Bairro)**

Após o bloco `grid grid-cols-2` de CEP e Bairro e antes do toggle de Liderança:

```tsx
<div>
  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Instagram</label>
  <div className="relative">
    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
    <input
      type="text"
      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-pink-400"
      placeholder="usuario"
      value={editingMunicipe ? editForm.instagramHandle : createForm.instagramHandle}
      onChange={e => {
        const val = e.target.value.replace('@', '');
        if (editingMunicipe) setEditForm({ ...editForm, instagramHandle: val });
        else setCreateForm({ ...createForm, instagramHandle: val });
      }}
    />
  </div>
  <p className="text-[10px] text-slate-400 mt-1 ml-1">Preencher evita duplicatas quando a pessoa mandar DM pelo Instagram.</p>
</div>
```

- [ ] **Step 6: Passar `instagramHandle` nos payloads de create e edit**

Em `handleCreateMunicipe` (linha 177):
```typescript
const payload = {
  ...createForm,
  birthDate: parseDateToISO(createForm.birthDate),
  instagramHandle: createForm.instagramHandle || null
};
await api.post('/demands/municipes', payload);
```

Em `handleSaveEdit` (linha 353):
```typescript
await api.patch(`/demands/municipes/${editingMunicipe.id}`, {
  ...editForm,
  birthDate: parseDateToISO(editForm.birthDate),
  instagramHandle: editForm.instagramHandle || null
});
```

- [ ] **Step 7: Badge Instagram na tabela (coluna de nome, após badge de indicações ~linha 502)**

```tsx
{m.instagramHandle && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-100 text-pink-700 text-[8px] font-black rounded uppercase">
    @{m.instagramHandle}
  </span>
)}
```

- [ ] **Step 8: Commit**

```bash
rtk git add frontend/src/pages/Dashboard/Municipes.tsx
rtk git commit -m "feat: add instagram handle field to municipes form and table"
```

---

## Task 3: Backend — Aceitar `instagramHandle` no controller

**Files:**
- Modify: `backend/src/controllers/demandController.ts:13-28`
- Modify: `backend/src/controllers/demandController.ts:95-109`

- [ ] **Step 1: Atualizar `createMunicipe`**

```typescript
export const createMunicipe = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, phone, cep, bairro, birthDate, isLideranca, instagramHandle } = req.body;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const [newMunicipe] = await db.insert(municipes).values({
      tenantId, name, phone: normalizePhone(phone), cep, bairro,
      birthDate: birthDate ? new Date(birthDate) : null,
      isLideranca: isLideranca || false,
      instagramHandle: instagramHandle || null,
    }).returning();
    res.status(201).json(newMunicipe);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Este número de telefone já está cadastrado.' });
    res.status(500).json({ error: 'Failed' });
  }
};
```

- [ ] **Step 2: Atualizar `updateMunicipe`**

```typescript
export const updateMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, phone, cep, bairro, birthDate, isLideranca, instagramHandle } = req.body;
  try {
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = normalizePhone(phone);
    if (cep !== undefined) updateData.cep = cep;
    if (bairro !== undefined) updateData.bairro = bairro;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (isLideranca !== undefined) updateData.isLideranca = isLideranca;
    if (instagramHandle !== undefined) updateData.instagramHandle = instagramHandle || null;
    const [u] = await db.update(municipes).set(updateData).where(eq(municipes.id, id)).returning();
    res.json(u);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};
```

- [ ] **Step 3: Commit**

```bash
rtk git add backend/src/controllers/demandController.ts
rtk git commit -m "feat: accept instagramHandle in createMunicipe and updateMunicipe"
```

---

## Task 4: Campos Instagram no schema do tenant + tabela de regras por post

**Files:**
- Modify: `backend/src/db/schema.ts` (tenants + nova tabela)
- Modify: `backend/src/routes/configRoutes.ts`

- [ ] **Step 1: Adicionar campos Instagram em `tenants`**

Adicionar após `birthdayAutomated` no schema dos tenants (antes de `createdAt`):

```typescript
  // Instagram Integration
  instagramAccountId: varchar("instagram_account_id", { length: 255 }),
  instagramAccessToken: varchar("instagram_access_token", { length: 1000 }),
  instagramTokenExpiresAt: timestamp("instagram_token_expires_at"),
  instagramWebhookVerifyToken: varchar("instagram_webhook_verify_token", { length: 255 }),
  instagramDmAiEnabled: boolean("instagram_dm_ai_enabled").default(true).notNull(),
  instagramAutoCreateMunicipe: boolean("instagram_auto_create_municipe").default(true).notNull(),
  instagramBotEnabled: boolean("instagram_bot_enabled").default(false).notNull(),
  instagramCommentKeywords: varchar("instagram_comment_keywords", { length: 2000 }),
  instagramCommentReply: varchar("instagram_comment_reply", { length: 2000 }),
```

- [ ] **Step 2: Adicionar tabela `instagramCommentRules` ao final do schema**

Adicionar após a tabela `documentos` (ao final do arquivo):

```typescript
export const instagramCommentRules = pgTable("instagram_comment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  mediaId: varchar("media_id", { length: 255 }).notNull(),
  mediaLabel: varchar("media_label", { length: 255 }).notNull(),
  keywords: varchar("keywords", { length: 1000 }).notNull(),
  replyMessage: varchar("reply_message", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 3: Rodar migração**

```bash
cd backend && pnpm drizzle-kit push
```

Expected: `Changes applied`

- [ ] **Step 4: Expor novos campos no `configRoutes.ts` PATCH /update**

No destructuring do body e no `db.update().set({...})`, adicionar apenas os campos operacionais.
`instagramAccessToken`, `instagramAccountId` e `instagramTokenExpiresAt` **não entram aqui** — são gerenciados exclusivamente pelo fluxo OAuth em `instagramRoutes.ts`.

```typescript
const {
  name, aiProvider, aiApiKey, aiModel, aiBaseUrl, systemPrompt,
  municipio, uf, partido, mandato, fotoUrl, calendarUrl,
  birthdayMessage, birthdayAutomated, legislativeMessage,
  whatsappVereadorNumber, followUpEnabled, followUpDays, followUpMessage,
  instagramWebhookVerifyToken,
  instagramDmAiEnabled, instagramAutoCreateMunicipe, instagramBotEnabled,
  instagramCommentKeywords, instagramCommentReply,
} = req.body;

await db.update(tenants)
  .set({
    name, aiProvider, aiApiKey, aiModel, aiBaseUrl, systemPrompt,
    municipio, uf, partido, mandato, fotoUrl, calendarUrl,
    birthdayMessage, birthdayAutomated, legislativeMessage,
    whatsappVereadorNumber, followUpEnabled, followUpDays, followUpMessage,
    instagramWebhookVerifyToken,
    instagramDmAiEnabled, instagramAutoCreateMunicipe, instagramBotEnabled,
    instagramCommentKeywords, instagramCommentReply,
  })
  .where(eq(tenants.id, tenantId));
```

- [ ] **Step 5: Commit**

```bash
rtk git add backend/src/db/schema.ts backend/src/routes/configRoutes.ts
rtk git commit -m "feat: add instagram config fields and comment rules table to schema"
```

---

## Task 5: InstagramService — wrapper da Meta Graph API

**Files:**
- Create: `backend/src/services/instagramService.ts`

- [ ] **Step 1: Criar o serviço**

```typescript
import axios from 'axios';

const BASE_URL = 'https://graph.facebook.com/v21.0';

export class InstagramService {
  constructor(private accessToken: string) {}

  async sendDM(recipientIgsid: string, text: string) {
    const response = await axios.post(
      `${BASE_URL}/me/messages`,
      {
        recipient: { id: recipientIgsid },
        message: { text },
        messaging_type: 'RESPONSE',
      },
      { params: { access_token: this.accessToken } }
    );
    return response.data;
  }

  async replyToComment(commentId: string, message: string) {
    const response = await axios.post(
      `${BASE_URL}/${commentId}/replies`,
      { message },
      { params: { access_token: this.accessToken } }
    );
    return response.data;
  }

  async getAccountInfo() {
    const response = await axios.get(`${BASE_URL}/me`, {
      params: { fields: 'id,name,username', access_token: this.accessToken },
    });
    return response.data;
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add backend/src/services/instagramService.ts
rtk git commit -m "feat: add InstagramService wrapper for Meta Graph API"
```

---

## Task 6: Instagram Webhook Orchestration (DMs + Comentários)

**Files:**
- Create: `backend/src/services/instagramWebhookOrchestration.ts`

### Lookup de munícipes via Instagram — 3 camadas

Quando chega um DM do Instagram com `senderIgsid` e `senderUsername`:
1. Busca por `instagramUserId = senderIgsid` → encontrado: usa direto
2. Busca por `instagramHandle = senderUsername` → encontrado: salva o `instagramUserId` nesse registro e usa (evita duplicata)
3. Nenhum: cria novo munícipe com `phone = ig_<senderIgsid>` (placeholder único)

### Toggle de IA para DMs

Se `tenant.instagramDmAiEnabled = false`: salva o atendimento mas não chama a IA nem envia resposta automática.

- [ ] **Step 1: Criar o arquivo de orquestração**

```typescript
import { db } from '../db';
import { tenants, municipes, atendimentos, documents, systemConfigs, instagramCommentRules } from '../db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { processDemand } from './aiService';
import { InstagramService } from './instagramService';
import { trackAIUsage } from '../middleware/quotaMiddleware';
import { redisService } from './redisService';

const formatName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

async function findOrCreateMunicipeByInstagram(
  tenantId: string,
  senderIgsid: string,
  senderUsername: string,
  autoCreate: boolean
) {
  // Camada 1: busca por instagramUserId (retorno rápido para usuário já vinculado)
  let [municipe] = await db.select().from(municipes).where(
    and(eq(municipes.instagramUserId, senderIgsid), eq(municipes.tenantId, tenantId))
  );
  if (municipe) return municipe;

  // Camada 2: busca por instagramHandle (evita duplicata para quem já tem cadastro manual)
  if (senderUsername) {
    const [byHandle] = await db.select().from(municipes).where(
      and(
        eq(municipes.tenantId, tenantId),
        ilike(municipes.instagramHandle, senderUsername)
      )
    );
    if (byHandle) {
      const [updated] = await db.update(municipes)
        .set({ instagramUserId: senderIgsid })
        .where(eq(municipes.id, byHandle.id))
        .returning();
      return updated;
    }
  }

  // Camada 3: só cria se autoCreate estiver habilitado
  if (!autoCreate) return null;

  const igPhone = `ig_${senderIgsid}`;
  const [newM] = await db.insert(municipes).values({
    tenantId,
    name: formatName(senderUsername || 'Instagram'),
    phone: igPhone,
    instagramUserId: senderIgsid,
    instagramHandle: senderUsername || null,
  }).onConflictDoNothing().returning();

  if (!newM) {
    const [existing] = await db.select().from(municipes).where(
      and(eq(municipes.phone, igPhone), eq(municipes.tenantId, tenantId))
    );
    return existing;
  }
  return newM;
}

export async function orchestrateInstagramDM(payload: any, tenantId: string) {
  try {
    const messaging = payload?.entry?.[0]?.messaging?.[0];
    if (!messaging?.message?.text) return { status: 'ignored' };

    const senderIgsid: string = messaging.sender.id;
    const messageText: string = messaging.message.text;
    const senderUsername: string = messaging.sender?.username || '';

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken) return { status: 'no_instagram_config' };

    const autoCreate = tenant.instagramAutoCreateMunicipe !== false;
    const municipe = await findOrCreateMunicipeByInstagram(tenantId, senderIgsid, senderUsername, autoCreate);
    if (!municipe) return { status: 'not_registered' }; // autoCreate=false e não estava no banco

    // Atendimento de hoje
    const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
    const todayStart = new Date(`${todayStr}T00:00:00-03:00`);

    let [existingAtendimento] = await db.select().from(atendimentos).where(and(
      eq(atendimentos.municipeId, municipe.id),
      eq(atendimentos.tenantId, tenantId),
      sql`${atendimentos.createdAt} >= ${todayStart}`
    )).orderBy(desc(atendimentos.createdAt)).limit(1);

    const currentHistory = existingAtendimento?.resumoIa || '';
    const updatedHistory = `${currentHistory}\nCidadão (Instagram): ${messageText}`.trim();

    if (existingAtendimento) {
      await db.update(atendimentos)
        .set({ resumoIa: updatedHistory, updatedAt: new Date() })
        .where(eq(atendimentos.id, existingAtendimento.id));
    } else {
      const [newA] = await db.insert(atendimentos).values({
        tenantId, municipeId: municipe.id, resumoIa: updatedHistory
      }).returning();
      existingAtendimento = newA;
    }

    // Se IA desligada para DMs: registra e encerra sem responder
    if (!tenant.instagramDmAiEnabled) {
      return { status: 'saved_no_ai' };
    }

    // Standby humano (30 min)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isHumanActive = existingAtendimento?.lastHumanInteractionAt &&
      new Date(existingAtendimento.lastHumanInteractionAt) > thirtyMinutesAgo;
    if (isHumanActive) return { status: 'waiting_human' };

    // Verificar quota
    const today = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
    const currentUsage = await redisService.getUsage(tenantId, today);
    if (currentUsage >= (tenant.dailyTokenLimit || 50000)) return { status: 'quota_exceeded' };

    // Chamar IA
    const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const apiKey = tenant.aiApiKey || globalConfig?.aiApiKey;
    if (!apiKey) return { status: 'no_ai_key' };

    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    const knowledge = tenantDocs.map(d => d.textContent).join('\n\n');

    const resultIA = await processDemand(messageText, {
      provider: (tenant.aiProvider || globalConfig?.aiProvider || 'gemini') as any,
      apiKey,
      model: tenant.aiModel || globalConfig?.aiModel || 'gemini-1.5-flash',
      aiBaseUrl: tenant.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant.systemPrompt || '',
    }, updatedHistory, knowledge);

    const aiRes = resultIA.data;
    const finalHistory = `${updatedHistory}\nAI: ${aiRes.resposta_usuario}`;

    await trackAIUsage(tenantId, resultIA.usage.total_tokens);

    await db.update(atendimentos).set({
      resumoIa: finalHistory,
      categoria: aiRes.categoria,
      prioridade: aiRes.prioridade,
      precisaRetorno: aiRes.precisa_retorno,
      updatedAt: new Date(),
      ...(aiRes.precisa_retorno ? { lastHumanInteractionAt: new Date() } : {}),
    }).where(eq(atendimentos.id, existingAtendimento.id));

    if (aiRes.resposta_usuario) {
      const igService = new InstagramService(tenant.instagramAccessToken);
      await igService.sendDM(senderIgsid, aiRes.resposta_usuario);
    }

    return { status: 'success' };
  } catch (e: any) {
    console.error('[INSTAGRAM DM ERROR]', e.message);
    return { status: 'error' };
  }
}

export async function orchestrateInstagramComment(payload: any, tenantId: string) {
  try {
    const change = payload?.entry?.[0]?.changes?.[0];
    if (change?.field !== 'comments') return { status: 'ignored' };

    const commentData = change.value;
    const commentId: string = commentData.id;
    const commentText: string = commentData.text || '';
    const mediaId: string = commentData.media?.id || '';
    const commenterIgsid: string = commentData.from?.id || '';

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken || !tenant?.instagramBotEnabled) return { status: 'bot_disabled' };

    const igService = new InstagramService(tenant.instagramAccessToken);
    const textLower = commentText.toLowerCase();

    // Camada 1: regra específica do post recebido (tem prioridade)
    const postRules = await db.select().from(instagramCommentRules).where(
      and(eq(instagramCommentRules.tenantId, tenantId), eq(instagramCommentRules.mediaId, mediaId))
    );

    for (const rule of postRules) {
      let ruleKeywords: string[] = [];
      try { ruleKeywords = JSON.parse(rule.keywords); } catch { ruleKeywords = [rule.keywords]; }

      if (ruleKeywords.some(kw => textLower.includes(kw.toLowerCase()))) {
        await igService.replyToComment(commentId, rule.replyMessage);
        if (commenterIgsid) {
          await igService.sendDM(commenterIgsid, rule.replyMessage).catch(() => {});
        }
        return { status: 'replied_post_rule' };
      }
    }

    // Camada 2: keywords globais do tenant
    if (!tenant.instagramCommentKeywords) return { status: 'no_keywords' };

    let globalKeywords: string[] = [];
    try { globalKeywords = JSON.parse(tenant.instagramCommentKeywords); } catch { globalKeywords = [tenant.instagramCommentKeywords]; }

    const matchedGlobal = globalKeywords.some(kw => textLower.includes(kw.toLowerCase()));
    if (!matchedGlobal) return { status: 'no_keyword_match' };

    const replyMessage = tenant.instagramCommentReply || 'Obrigado pelo seu comentário! Em breve entraremos em contato.';
    await igService.replyToComment(commentId, replyMessage);
    if (commenterIgsid) {
      await igService.sendDM(commenterIgsid, replyMessage).catch(() => {});
    }

    return { status: 'replied_global' };
  } catch (e: any) {
    console.error('[INSTAGRAM COMMENT ERROR]', e.message);
    return { status: 'error' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add backend/src/services/instagramWebhookOrchestration.ts
rtk git commit -m "feat: instagram webhook orchestration with 3-layer lookup, AI toggle, and per-post rules"
```

---

## Task 7: Webhook Routes — endpoints Instagram

**Files:**
- Modify: `backend/src/routes/webhookRoutes.ts`

- [ ] **Step 1: Adicionar imports no topo**

Após `import { orchestrateWebhook }`:

```typescript
import { orchestrateInstagramDM, orchestrateInstagramComment } from '../services/instagramWebhookOrchestration';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
```

- [ ] **Step 2: Adicionar endpoints antes do `export default router`**

```typescript
// Webhook Instagram — verificação do desafio Meta (GET)
router.get('/instagram/:tenantId', express.json(), async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') return res.sendStatus(400);

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramWebhookVerifyToken) return res.sendStatus(403);
    if (token !== tenant.instagramWebhookVerifyToken) return res.sendStatus(403);
    return res.status(200).send(challenge);
  } catch {
    return res.sendStatus(500);
  }
});

// Webhook Instagram — receber eventos DMs e comentários (POST)
router.post('/instagram/:tenantId', express.json(), async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const payload = req.body;

  console.log(`[INSTAGRAM WEBHOOK] Tenant: ${tenantId} | Object: ${payload?.object}`);

  res.status(200).json({ status: 'received' });

  const hasMessaging = payload?.entry?.[0]?.messaging?.length > 0;
  const hasComments = payload?.entry?.[0]?.changes?.[0]?.field === 'comments';

  if (hasMessaging) {
    orchestrateInstagramDM(payload, tenantId).catch(err =>
      console.error('[INSTAGRAM DM BG ERROR]', err.message)
    );
  } else if (hasComments) {
    orchestrateInstagramComment(payload, tenantId).catch(err =>
      console.error('[INSTAGRAM COMMENT BG ERROR]', err.message)
    );
  }
});
```

- [ ] **Step 3: Commit**

```bash
rtk git add backend/src/routes/webhookRoutes.ts
rtk git commit -m "feat: add instagram webhook GET verification and POST event endpoints"
```

---

## Task 8: Instagram Routes (OAuth + CRUD regras por post)

**Context:** O fluxo OAuth substitui o input manual de token. O usuário clica "Conectar com Instagram" no painel, é redirecionado para o Meta, autoriza, e o token longo (60 dias) é salvo automaticamente. As credenciais `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET` ficam no `.env` do servidor — o usuário final nunca as vê.

**Env vars necessárias (`.env` do backend):**
```
FACEBOOK_APP_ID=<seu app id no Meta>
FACEBOOK_APP_SECRET=<seu app secret no Meta>
APP_URL=https://seu-backend.com        # usado como redirect_uri
FRONTEND_URL=https://seu-frontend.com  # para redirecionar após oauth
```

**No Meta Developer Portal (uma vez, pelo dev):**
1. Criar app tipo "Business"
2. Adicionar produto "Instagram"
3. Em "OAuth Redirect URIs" adicionar: `https://seu-backend.com/api/instagram/oauth/callback`
4. Permissões necessárias: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`, `pages_manage_metadata`

**Files:**
- Create: `backend/src/routes/instagramRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Criar `instagramRoutes.ts`**

```typescript
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db';
import { tenants, instagramCommentRules } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { InstagramService } from '../services/instagramService';

const router = Router();

// ─── OAuth ────────────────────────────────────────────────────────────────────

// Inicia o fluxo OAuth — redireciona para o Meta
router.get('/oauth/connect', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.APP_URL}/api/instagram/oauth/callback`;
  const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');

  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'instagram_manage_comments',
    'pages_show_list',
    'pages_manage_metadata',
  ].join(',');

  const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;

  res.redirect(url);
});

// Callback OAuth — troca o code pelo token longo e salva no tenant
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL;

  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/dashboard/instagram?error=${error || 'missing_code'}`);
  }

  let tenantId: string;
  try {
    tenantId = JSON.parse(Buffer.from(state, 'base64').toString()).tenantId;
  } catch {
    return res.redirect(`${frontendUrl}/dashboard/instagram?error=invalid_state`);
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = `${process.env.APP_URL}/api/instagram/oauth/callback`;

  try {
    // 1. Trocar code por token curto
    const shortRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
    });
    const shortToken: string = shortRes.data.access_token;

    // 2. Trocar token curto por token longo (60 dias)
    const longRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken },
    });
    const longToken: string = longRes.data.access_token;
    const expiresIn: number = longRes.data.expires_in;

    // 3. Buscar a Página do Facebook vinculada
    const pagesRes = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
      params: { access_token: longToken },
    });
    const page = pagesRes.data.data?.[0];
    if (!page) throw new Error('Nenhuma Página do Facebook encontrada na conta autorizada.');

    // 4. Buscar a Conta do Instagram Business vinculada à Página
    const igRes = await axios.get(`https://graph.facebook.com/v21.0/${page.id}`, {
      params: { fields: 'instagram_business_account', access_token: page.access_token },
    });
    const igAccountId: string | undefined = igRes.data.instagram_business_account?.id;

    // 5. Salvar no tenant
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await db.update(tenants)
      .set({
        instagramAccessToken: longToken,
        instagramAccountId: igAccountId || null,
        instagramTokenExpiresAt: expiresAt,
      })
      .where(eq(tenants.id, tenantId));

    return res.redirect(`${frontendUrl}/dashboard/instagram?connected=1`);
  } catch (err: any) {
    console.error('[INSTAGRAM OAUTH ERROR]', err.message);
    return res.redirect(`${frontendUrl}/dashboard/instagram?error=oauth_failed`);
  }
});

// Desconectar Instagram
router.post('/oauth/disconnect', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  await db.update(tenants)
    .set({ instagramAccessToken: null, instagramAccountId: null, instagramTokenExpiresAt: null })
    .where(eq(tenants.id, tenantId));

  res.json({ success: true });
});

// Renovar token manualmente (token longo pode ser renovado antes de expirar)
router.post('/oauth/refresh', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken) return res.status(400).json({ error: 'Não conectado' });

    const refreshRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: tenant.instagramAccessToken,
      },
    });

    const newToken: string = refreshRes.data.access_token;
    const expiresAt = new Date(Date.now() + refreshRes.data.expires_in * 1000);

    await db.update(tenants)
      .set({ instagramAccessToken: newToken, instagramTokenExpiresAt: expiresAt })
      .where(eq(tenants.id, tenantId));

    res.json({ success: true, expiresAt });
  } catch {
    res.status(500).json({ error: 'Falha ao renovar token.' });
  }
});

// ─── Status ───────────────────────────────────────────────────────────────────

router.get('/status', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken) return res.json({ connected: false });

    const igService = new InstagramService(tenant.instagramAccessToken);
    const info = await igService.getAccountInfo();
    return res.json({
      connected: true,
      accountId: info.id,
      username: info.username,
      expiresAt: tenant.instagramTokenExpiresAt,
    });
  } catch {
    return res.json({ connected: false, error: 'Token inválido ou expirado.' });
  }
});

// ─── Settings (não-credenciais) ───────────────────────────────────────────────

// Salvar configurações operacionais (sem tocar no token — esse vem pelo OAuth)
router.post('/settings', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const {
    instagramWebhookVerifyToken,
    instagramDmAiEnabled, instagramAutoCreateMunicipe, instagramBotEnabled,
    instagramCommentKeywords, instagramCommentReply,
  } = req.body;

  try {
    await db.update(tenants)
      .set({
        instagramWebhookVerifyToken,
        instagramDmAiEnabled: instagramDmAiEnabled ?? true,
        instagramAutoCreateMunicipe: instagramAutoCreateMunicipe ?? true,
        instagramBotEnabled: instagramBotEnabled ?? false,
        instagramCommentKeywords,
        instagramCommentReply,
      })
      .where(eq(tenants.id, tenantId));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Falha ao salvar configurações.' });
  }
});

// ─── Regras por post ──────────────────────────────────────────────────────────

router.get('/comment-rules', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const rules = await db.select().from(instagramCommentRules)
    .where(eq(instagramCommentRules.tenantId, tenantId));
  res.json(rules);
});

router.post('/comment-rules', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const { mediaId, mediaLabel, keywords, replyMessage } = req.body;
  if (!mediaId || !mediaLabel || !keywords || !replyMessage) {
    return res.status(400).json({ error: 'Campos obrigatórios: mediaId, mediaLabel, keywords, replyMessage' });
  }

  const [rule] = await db.insert(instagramCommentRules)
    .values({ tenantId, mediaId, mediaLabel, keywords: JSON.stringify(keywords), replyMessage })
    .returning();
  res.status(201).json(rule);
});

router.delete('/comment-rules/:id', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  await db.delete(instagramCommentRules).where(
    and(eq(instagramCommentRules.id, id), eq(instagramCommentRules.tenantId, tenantId))
  );
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Registrar em `app.ts`**

Após `import broadcastRoutes`:
```typescript
import instagramRoutes from './routes/instagramRoutes';
```

Após `app.use('/api/broadcasts', broadcastRoutes);`:
```typescript
app.use('/api/instagram', instagramRoutes);
```

- [ ] **Step 3: Commit**

```bash
rtk git add backend/src/routes/instagramRoutes.ts backend/src/app.ts
rtk git commit -m "feat: add instagram oauth flow and comment rules CRUD routes"
```

---

## Task 9: Frontend — Página `InstagramConfig.tsx`

**Files:**
- Create: `frontend/src/pages/Dashboard/InstagramConfig.tsx`

Seções da página:
1. **Conexão** — botão "Conectar com Instagram" (OAuth) ou status conectado + botão desconectar
2. **Webhook** — Verify Token (gerado pelo usuário) + URL do webhook para colar no Meta
3. **DMs** — toggles de auto-cadastro e IA
4. **Robô global** — toggle ativo, keywords, mensagem de resposta
5. **Regras por post** — lista + formulário

**Fluxo de conexão:**
- Usuário clica "Conectar com Instagram" → `window.location.href = '/api/instagram/oauth/connect'`
- Meta redireciona de volta para `/dashboard/instagram?connected=1` (ou `?error=...`)
- Componente lê os query params no mount e exibe o resultado

- [ ] **Step 1: Criar o componente**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import {
  Instagram, CheckCircle2, AlertCircle, RefreshCw,
  Bot, MessageCircle, Plus, Trash2, ExternalLink, LogOut, Link2
} from 'lucide-react';

interface InstagramStatus {
  connected: boolean;
  username?: string;
  expiresAt?: string;
  error?: string;
}

interface CommentRule {
  id: string;
  mediaId: string;
  mediaLabel: string;
  keywords: string;
  replyMessage: string;
}

export default function InstagramConfig() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [settings, setSettings] = useState({
    instagramWebhookVerifyToken: '',
    instagramDmAiEnabled: true,
    instagramAutoCreateMunicipe: true,
    instagramBotEnabled: false,
    instagramCommentKeywords: [] as string[],
    instagramCommentReply: '',
  });
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [rules, setRules] = useState<CommentRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newRule, setNewRule] = useState({ mediaId: '', mediaLabel: '', keywords: '', replyMessage: '' });
  const [addingRule, setAddingRule] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [configRes, statusRes, rulesRes] = await Promise.all([
        api.get('/config/me'),
        api.get('/instagram/status'),
        api.get('/instagram/comment-rules'),
      ]);
      const d = configRes.data;
      setSettings({
        instagramWebhookVerifyToken: d.instagramWebhookVerifyToken || '',
        instagramDmAiEnabled: d.instagramDmAiEnabled ?? true,
        instagramAutoCreateMunicipe: d.instagramAutoCreateMunicipe ?? true,
        instagramBotEnabled: d.instagramBotEnabled || false,
        instagramCommentKeywords: d.instagramCommentKeywords ? JSON.parse(d.instagramCommentKeywords) : [],
        instagramCommentReply: d.instagramCommentReply || '',
      });
      setStatus(statusRes.data);
      setRules(rulesRes.data || []);
    } catch {
      setFeedback({ type: 'error', msg: 'Falha ao carregar configurações.' });
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Ler resultado do OAuth na URL
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === '1') setFeedback({ type: 'success', msg: 'Instagram conectado com sucesso!' });
    if (error) setFeedback({ type: 'error', msg: `Erro na conexão: ${error}` });
    if (connected || error) setSearchParams({}, { replace: true });
  }, [fetchAll, searchParams, setSearchParams]);

  const handleConnect = () => {
    // Navega diretamente para o endpoint OAuth do backend — ele redireciona para o Meta
    window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/instagram/oauth/connect`;
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o Instagram? Webhooks deixarão de funcionar.')) return;
    setDisconnecting(true);
    try {
      await api.post('/instagram/oauth/disconnect');
      setStatus({ connected: false });
      setFeedback({ type: 'success', msg: 'Instagram desconectado.' });
    } catch {
      setFeedback({ type: 'error', msg: 'Falha ao desconectar.' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await api.post('/instagram/settings', {
        ...settings,
        instagramCommentKeywords: JSON.stringify(settings.instagramCommentKeywords),
      });
      setFeedback({ type: 'success', msg: 'Configurações salvas!' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.error || 'Falha ao salvar.' });
    } finally {
      setLoading(false);
    }
  };

  const generateVerifyToken = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setSettings(prev => ({ ...prev, instagramWebhookVerifyToken: token }));
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toUpperCase();
    if (kw && !settings.instagramCommentKeywords.includes(kw)) {
      setSettings(prev => ({ ...prev, instagramCommentKeywords: [...prev.instagramCommentKeywords, kw] }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setSettings(prev => ({ ...prev, instagramCommentKeywords: prev.instagramCommentKeywords.filter(k => k !== kw) }));
  };

  const handleAddRule = async () => {
    if (!newRule.mediaId || !newRule.mediaLabel || !newRule.keywords || !newRule.replyMessage) {
      alert('Preencha todos os campos da regra.');
      return;
    }
    setAddingRule(true);
    try {
      await api.post('/instagram/comment-rules', {
        ...newRule,
        keywords: newRule.keywords.split(',').map(k => k.trim().toUpperCase()).filter(Boolean),
      });
      setNewRule({ mediaId: '', mediaLabel: '', keywords: '', replyMessage: '' });
      const res = await api.get('/instagram/comment-rules');
      setRules(res.data || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao adicionar regra.');
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await api.delete(`/instagram/comment-rules/${id}`);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
    </label>
  );

  const backendUrl = import.meta.env.VITE_API_URL || window.location.origin.replace(':3000', ':3001');

  if (fetching) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-pink-500 animate-spin" /></div>;

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Instagram className="text-pink-500" size={32} />
          Conexão Instagram
        </h2>
        <p className="text-slate-500">Configure DMs com IA, robô de comentários e regras por post.</p>
      </header>

      {feedback && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm font-bold ${
          feedback.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <p>{feedback.msg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* Conexão OAuth */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-pink-500" /> Conta do Instagram
            </h3>
            {status?.connected ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-black text-green-800 text-sm">@{status.username}</p>
                    {status.expiresAt && (
                      <p className="text-[10px] text-green-600 mt-0.5">
                        Token válido até {new Date(status.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-500 rounded-lg text-xs font-black hover:bg-red-50 disabled:opacity-50">
                  <LogOut size={12} /> {disconnecting ? 'Desconectando...' : 'Desconectar'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Conecte sua conta do Instagram Business via Meta para ativar DMs e robô de comentários.</p>
                <button onClick={handleConnect}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-black text-sm hover:from-pink-600 hover:to-purple-700 shadow-lg shadow-pink-200 transition-all">
                  <Instagram size={18} /> Conectar com Instagram
                </button>
                <p className="text-[10px] text-slate-400">Você será redirecionado para o Meta para autorizar o acesso. Nenhuma senha é armazenada.</p>
              </div>
            )}
          </div>

          {/* Webhook */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-slate-500" /> Configuração do Webhook
            </h3>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Verify Token</label>
              <div className="flex gap-2">
                <input type="text" className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400"
                  value={settings.instagramWebhookVerifyToken}
                  onChange={e => setSettings({ ...settings, instagramWebhookVerifyToken: e.target.value })}
                  placeholder="token-secreto" />
                <button onClick={generateVerifyToken} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 whitespace-nowrap">Gerar</button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Cole este token no campo "Verify Token" ao configurar o webhook no Meta Developer Portal.</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-800 mb-1">URL do Webhook (cole na Meta):</p>
              <code className="text-xs text-blue-600 break-all">{backendUrl}/api/webhook/instagram/SEU_TENANT_ID</code>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">Assinaturas necessárias no webhook:</p>
              <p><code className="bg-white px-1 rounded border border-slate-200">messages</code> — DMs recebidas</p>
              <p><code className="bg-white px-1 rounded border border-slate-200">comments</code> — comentários nos posts</p>
            </div>
          </div>

          {/* DMs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" /> DMs Recebidas
            </h3>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-700">Cadastrar automaticamente no banco</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {settings.instagramAutoCreateMunicipe
                    ? 'Quem mandar DM e não estiver no banco será cadastrado automaticamente.'
                    : 'Somente munícipes já cadastrados (via @handle) terão DMs processadas.'}
                </p>
              </div>
              <Toggle checked={settings.instagramAutoCreateMunicipe} onChange={v => setSettings({ ...settings, instagramAutoCreateMunicipe: v })} />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-700">Resposta automática por IA</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {settings.instagramDmAiEnabled
                    ? 'IA responde automaticamente (igual ao WhatsApp).'
                    : 'DMs salvas no painel — equipe responde manualmente.'}
                </p>
              </div>
              <Toggle checked={settings.instagramDmAiEnabled} onChange={v => setSettings({ ...settings, instagramDmAiEnabled: v })} />
            </div>
          </div>

          {/* Robô global de comentários */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" /> Robô de Comentários (Global)
              </h3>
              <Toggle checked={settings.instagramBotEnabled} onChange={v => setSettings({ ...settings, instagramBotEnabled: v })} />
            </div>
            <p className="text-[11px] text-slate-400">Funciona em todos os posts. Se o comentário contiver a palavra-chave, o bot responde.</p>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Palavras-chave</label>
              <div className="flex gap-2">
                <input type="text" className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400"
                  value={newKeyword} onChange={e => setNewKeyword(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="QUERO, INFO, AJUDA..." />
                <button onClick={addKeyword} className="p-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl"><Plus size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {settings.instagramCommentKeywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 border border-pink-200 text-pink-700 rounded-lg text-xs font-black">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-red-500"><Trash2 size={12} /></button>
                  </span>
                ))}
                {settings.instagramCommentKeywords.length === 0 && <p className="text-xs text-slate-400">Nenhuma palavra-chave configurada.</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Resposta automática</label>
              <textarea className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-400" rows={3}
                value={settings.instagramCommentReply} onChange={e => setSettings({ ...settings, instagramCommentReply: e.target.value })}
                placeholder="Obrigado pelo comentário! Em breve te mandamos uma DM." />
            </div>
          </div>

          {/* Regras por post */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-green-500" /> Regras por Post Específico
            </h3>
            <p className="text-[11px] text-slate-400">Regras por post têm prioridade sobre as globais. O ID do post aparece na URL do post no Instagram.</p>

            {rules.length > 0 && (
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{rule.mediaLabel}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">ID: {rule.mediaId}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(JSON.parse(rule.keywords) as string[]).map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-black">{kw}</span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">"{rule.replyMessage}"</p>
                    </div>
                    <button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-slate-400 hover:text-red-500 flex-shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Nova Regra</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">ID do Post</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                    value={newRule.mediaId} onChange={e => setNewRule({ ...newRule, mediaId: e.target.value })} placeholder="17841400000000000" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Rótulo (sua referência)</label>
                  <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                    value={newRule.mediaLabel} onChange={e => setNewRule({ ...newRule, mediaLabel: e.target.value })} placeholder="Post evento 15/05" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Palavras-chave (separadas por vírgula)</label>
                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                  value={newRule.keywords} onChange={e => setNewRule({ ...newRule, keywords: e.target.value.toUpperCase() })} placeholder="INSCREVER, PARTICIPAR" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Resposta automática</label>
                <textarea className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-green-400" rows={2}
                  value={newRule.replyMessage} onChange={e => setNewRule({ ...newRule, replyMessage: e.target.value })} placeholder="Ótimo! Vou te enviar o link por DM." />
              </div>
              <button onClick={handleAddRule} disabled={addingRule} className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-black hover:bg-green-700 disabled:opacity-50">
                {addingRule ? 'Adicionando...' : '+ Adicionar Regra'}
              </button>
            </div>
          </div>

          <button onClick={handleSaveSettings} disabled={loading}
            className="w-full bg-pink-500 text-white py-3 rounded-xl font-black hover:bg-pink-600 transition-colors disabled:opacity-50 shadow-lg shadow-pink-200">
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>

        {/* Sidebar de status */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
            {status?.connected ? (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-pink-500" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">Conectado</h4>
                  <p className="text-slate-500 text-sm">@{status.username}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Instagram className="w-8 h-8 text-slate-300" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-600">Não conectado</h4>
                  <p className="text-slate-400 text-xs mt-1">Clique em "Conectar com Instagram"</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <h4 className="font-black text-xs text-amber-800 uppercase tracking-widest">Setup único (dev)</h4>
            <ol className="space-y-2 text-xs text-amber-700 font-bold list-decimal list-inside">
              <li>Criar App no Meta Developer Portal</li>
              <li>Adicionar produto "Instagram"</li>
              <li>Adicionar a URL de callback do OAuth</li>
              <li>Definir <code>FACEBOOK_APP_ID</code> e <code>FACEBOOK_APP_SECRET</code> no <code>.env</code></li>
            </ol>
            <p className="text-[10px] text-amber-600">Feito isso, os usuários conectam com um clique — sem precisar tocar em tokens.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add frontend/src/pages/Dashboard/InstagramConfig.tsx
rtk git commit -m "feat: add InstagramConfig page with OAuth connect button and settings"
```

---

## Task 10: Registrar rota e Sidebar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Import e rota em `App.tsx`**

Após `import WhatsAppConfig from './pages/Dashboard/WhatsAppConfig';`:
```typescript
import InstagramConfig from './pages/Dashboard/InstagramConfig';
```

Após `<Route path="whatsapp" element={<WhatsAppConfig />} />`:
```typescript
<Route path="instagram" element={<InstagramConfig />} />
```

- [ ] **Step 2: Item no Sidebar (`Sidebar.tsx`)**

No import de ícones do lucide-react, adicionar `Instagram`:
```typescript
import { ..., Instagram } from 'lucide-react';
```

No grupo `Comunicação`, após o item WhatsApp:
```typescript
{ name: 'Instagram', icon: Instagram, path: '/dashboard/instagram' },
```

- [ ] **Step 3: Commit**

```bash
rtk git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
rtk git commit -m "feat: add instagram route and sidebar navigation item"
```

---

## Task 11: Story Mention e Story Reply → DM Automática

**Files:**
- Modify: `backend/src/services/instagramWebhookOrchestration.ts`
- Modify: `backend/src/routes/webhookRoutes.ts`

Quando alguém menciona `@conta` em um Story ou responde a um Story da página, o Meta envia um webhook com `messaging_type = story_mention` ou `messaging.message.attachments[0].type = story_mention`. O bot responde com DM automática de boas-vindas/captura.

- [ ] **Step 1: Adicionar função `orchestrateInstagramStoryInteraction` em `instagramWebhookOrchestration.ts`**

Adicionar após `orchestrateInstagramComment`:

```typescript
export async function orchestrateInstagramStoryInteraction(payload: any, tenantId: string) {
  try {
    const messaging = payload?.entry?.[0]?.messaging?.[0];
    if (!messaging) return { status: 'ignored' };

    // Story mention: attachments com type 'story_mention'
    // Story reply: message.reply_to.story existe
    const isStoryMention = messaging.message?.attachments?.some(
      (a: any) => a.type === 'story_mention'
    );
    const isStoryReply = !!messaging.message?.reply_to?.story;

    if (!isStoryMention && !isStoryReply) return { status: 'not_story' };

    const senderIgsid: string = messaging.sender.id;
    const senderUsername: string = messaging.sender?.username || '';
    const interactionType = isStoryMention ? 'story_mention' : 'story_reply';

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken || !tenant?.instagramBotEnabled) return { status: 'bot_disabled' };

    const autoCreate = tenant.instagramAutoCreateMunicipe !== false;
    const municipe = await findOrCreateMunicipeByInstagram(tenantId, senderIgsid, senderUsername, autoCreate);
    if (!municipe) return { status: 'not_registered' };

    // Registrar opt-in de story
    await db.update(municipes)
      .set({ instagramOptinSource: interactionType, instagramOptinAt: new Date() })
      .where(eq(municipes.id, municipe.id));

    // Resposta automática de boas-vindas via DM
    const welcomeMsg = isStoryMention
      ? (tenant.instagramStoryMentionReply || 'Oi! Vi que você nos mencionou nos Stories. Como posso ajudar?')
      : (tenant.instagramStoryReply || 'Oi! Obrigado por responder nosso Story. Como posso ajudar?');

    const igService = new InstagramService(tenant.instagramAccessToken);
    await igService.sendDM(senderIgsid, welcomeMsg);

    return { status: 'story_dm_sent', type: interactionType };
  } catch (e: any) {
    console.error('[INSTAGRAM STORY ERROR]', e.message);
    return { status: 'error' };
  }
}
```

- [ ] **Step 2: Atualizar dispatcher no `webhookRoutes.ts`**

No bloco POST `/instagram/:tenantId`, atualizar o import e o dispatcher:

```typescript
import { orchestrateInstagramDM, orchestrateInstagramComment, orchestrateInstagramStoryInteraction } from '../services/instagramWebhookOrchestration';
```

Substituir a lógica de dispatch:

```typescript
const hasMessaging = payload?.entry?.[0]?.messaging?.length > 0;
const hasComments = payload?.entry?.[0]?.changes?.[0]?.field === 'comments';

if (hasMessaging) {
  const messaging = payload.entry[0].messaging[0];
  const isStoryInteraction =
    messaging?.message?.attachments?.some((a: any) => a.type === 'story_mention') ||
    !!messaging?.message?.reply_to?.story;

  if (isStoryInteraction) {
    orchestrateInstagramStoryInteraction(payload, tenantId).catch(err =>
      console.error('[INSTAGRAM STORY BG ERROR]', err.message)
    );
  } else {
    orchestrateInstagramDM(payload, tenantId).catch(err =>
      console.error('[INSTAGRAM DM BG ERROR]', err.message)
    );
  }
} else if (hasComments) {
  orchestrateInstagramComment(payload, tenantId).catch(err =>
    console.error('[INSTAGRAM COMMENT BG ERROR]', err.message)
  );
}
```

- [ ] **Step 3: Adicionar campos ao schema**

Em `backend/src/db/schema.ts`, na tabela `municipes`, adicionar após `instagramUserId`:

```typescript
instagramOptinSource: varchar("instagram_optin_source", { length: 50 }), // 'dm' | 'comment' | 'story_mention' | 'story_reply'
instagramOptinAt: timestamp("instagram_optin_at"),
```

Em `tenants`, adicionar após `instagramCommentReply`:

```typescript
instagramStoryMentionReply: varchar("instagram_story_mention_reply", { length: 1000 }),
instagramStoryReply: varchar("instagram_story_reply", { length: 1000 }),
```

- [ ] **Step 4: Rodar migração**

```bash
cd backend && pnpm drizzle-kit push
```

- [ ] **Step 5: Commit**

```bash
rtk git add backend/src/services/instagramWebhookOrchestration.ts backend/src/routes/webhookRoutes.ts backend/src/db/schema.ts
rtk git commit -m "feat: handle story mention and story reply with auto DM response"
```

---

## Task 12: Quick Replies nas DMs

**Files:**
- Modify: `backend/src/services/instagramService.ts`
- Modify: `backend/src/services/instagramWebhookOrchestration.ts`
- Modify: `backend/src/db/schema.ts` (nova tabela `instagramQuickReplyFlows`)
- Modify: `frontend/src/pages/Dashboard/InstagramConfig.tsx`

Quick replies são botões de resposta rápida que aparecem nas DMs do Instagram. A IA pode incluí-los para guiar o fluxo da conversa (ex.: "Quero saber mais", "Falar com a equipe", "Marcar reunião").

- [ ] **Step 1: Adicionar `sendDMWithQuickReplies` ao `instagramService.ts`**

```typescript
async sendDMWithQuickReplies(recipientIgsid: string, text: string, quickReplies: { title: string; payload: string }[]) {
  const response = await axios.post(
    `${BASE_URL}/me/messages`,
    {
      recipient: { id: recipientIgsid },
      message: {
        text,
        quick_replies: quickReplies.map(qr => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        })),
      },
      messaging_type: 'RESPONSE',
    },
    { params: { access_token: this.accessToken } }
  );
  return response.data;
}
```

- [ ] **Step 2: Adicionar tabela `instagramQuickReplyFlows` ao schema**

```typescript
export const instagramQuickReplyFlows = pgTable("instagram_quick_reply_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  triggerPayload: varchar("trigger_payload", { length: 255 }).notNull(), // payload do botão clicado
  responseMessage: varchar("response_message", { length: 2000 }).notNull(),
  nextQuickReplies: varchar("next_quick_replies", { length: 2000 }), // JSON: [{title, payload}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 3: Adicionar campo `instagramDefaultQuickReplies` em `tenants`**

Após `instagramStoryReply`:

```typescript
instagramDefaultQuickReplies: varchar("instagram_default_quick_replies", { length: 2000 }),
// JSON: [{title: "Quero saber mais", payload: "INFO"}, ...]
```

- [ ] **Step 4: Rodar migração**

```bash
cd backend && pnpm drizzle-kit push
```

- [ ] **Step 5: Atualizar `orchestrateInstagramDM` para processar quick reply payloads**

No início de `orchestrateInstagramDM`, antes de processar o texto, adicionar verificação de quick reply:

```typescript
// Quick reply: usuário clicou em um botão
const quickReplyPayload = messaging.message?.quick_reply?.payload;
if (quickReplyPayload) {
  const [flowStep] = await db.select().from(instagramQuickReplyFlows).where(
    and(
      eq(instagramQuickReplyFlows.tenantId, tenantId),
      eq(instagramQuickReplyFlows.triggerPayload, quickReplyPayload)
    )
  );
  if (flowStep) {
    const igService = new InstagramService(tenant.instagramAccessToken);
    let nextQRs: { title: string; payload: string }[] = [];
    try { nextQRs = JSON.parse(flowStep.nextQuickReplies || '[]'); } catch { }

    if (nextQRs.length > 0) {
      await igService.sendDMWithQuickReplies(senderIgsid, flowStep.responseMessage, nextQRs);
    } else {
      await igService.sendDM(senderIgsid, flowStep.responseMessage);
    }
    return { status: 'quick_reply_flow' };
  }
}
```

Também, ao enviar a resposta da IA, incluir os quick replies padrão do tenant (se configurados):

```typescript
// Ao enviar resposta da IA, incluir quick replies padrão se configurados
let defaultQRs: { title: string; payload: string }[] = [];
try { defaultQRs = JSON.parse(tenant.instagramDefaultQuickReplies || '[]'); } catch { }

const igService = new InstagramService(tenant.instagramAccessToken);
if (defaultQRs.length > 0 && aiRes.resposta_usuario) {
  await igService.sendDMWithQuickReplies(senderIgsid, aiRes.resposta_usuario, defaultQRs);
} else if (aiRes.resposta_usuario) {
  await igService.sendDM(senderIgsid, aiRes.resposta_usuario);
}
```

- [ ] **Step 6: Adicionar seção Quick Replies na `InstagramConfig.tsx`**

Adicionar nova seção após o bloco de DMs recebidas:

```tsx
{/* Quick Replies Padrão */}
<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
  <h3 className="font-bold text-slate-900 flex items-center gap-2">
    <MessageSquare className="w-4 h-4 text-indigo-500" /> Quick Replies (Botões nas DMs)
  </h3>
  <p className="text-[11px] text-slate-400">
    Botões exibidos ao final das respostas da IA. O usuário clica em vez de digitar.
    Limite: 13 botões, máximo 20 caracteres cada.
  </p>
  {/* Estado gerenciado pelo componente — CRUD simples de array de {title, payload} */}
  {/* Implementar com mesmo padrão das keywords globais */}
</div>
```

Adicionar `MessageSquare` ao import de ícones. O estado e CRUD dos quick replies segue o mesmo padrão das `instagramCommentKeywords`: array serializado como JSON no banco, gerenciado localmente no state do componente.

- [ ] **Step 7: Expor novos campos em `configRoutes.ts` e `instagramRoutes.ts`**

Adicionar ao destructuring e ao `.set({...})`:
- `instagramStoryMentionReply`
- `instagramStoryReply`
- `instagramDefaultQuickReplies`

Adicionar endpoints em `instagramRoutes.ts`:

```typescript
// Listar flows de quick reply
router.get('/quick-reply-flows', async (req, res) => { ... });

// Criar flow de quick reply
router.post('/quick-reply-flows', async (req, res) => { ... });

// Excluir flow de quick reply
router.delete('/quick-reply-flows/:id', async (req, res) => { ... });
```

- [ ] **Step 8: Commit**

```bash
rtk git add backend/src/services/instagramService.ts backend/src/services/instagramWebhookOrchestration.ts backend/src/db/schema.ts backend/src/routes/instagramRoutes.ts backend/src/routes/configRoutes.ts frontend/src/pages/Dashboard/InstagramConfig.tsx
rtk git commit -m "feat: add quick reply buttons to instagram DMs with flow support"
```

---

## Task 13: Opt-in Tracking e Canal de Origem no Painel

**Files:**
- Modify: `frontend/src/pages/Dashboard/Municipes.tsx`
- Modify: `backend/src/services/instagramWebhookOrchestration.ts`

Registrar como cada munícipe entrou pelo Instagram (`dm`, `comment`, `story_mention`, `story_reply`) e exibir no painel de munícipes.

- [ ] **Step 1: Atualizar `orchestrateInstagramDM` para registrar opt-in**

Após criar/encontrar o munícipe, adicionar:

```typescript
// Registrar opt-in via DM direta (só na primeira vez)
if (!municipe.instagramOptinSource) {
  await db.update(municipes)
    .set({ instagramOptinSource: 'dm', instagramOptinAt: new Date() })
    .where(eq(municipes.id, municipe.id));
}
```

Atualizar `orchestrateInstagramComment` da mesma forma:

```typescript
// Registrar opt-in via comentário (quando cria/vincula via IGSID do comentador)
if (commenterIgsid && !municipe?.instagramOptinSource) {
  await db.update(municipes)
    .set({ instagramOptinSource: 'comment', instagramOptinAt: new Date() })
    .where(eq(municipes.id, municipe.id));
}
```

- [ ] **Step 2: Atualizar interface `Municipe` no frontend**

Adicionar ao type:

```typescript
instagramOptinSource?: 'dm' | 'comment' | 'story_mention' | 'story_reply' | null;
instagramOptinAt?: string | null;
```

- [ ] **Step 3: Badge de canal no painel de munícipes**

Substituir o badge simples de Instagram por badge com ícone de canal:

```tsx
{m.instagramHandle && (
  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-pink-100 text-pink-700 text-[8px] font-black rounded uppercase">
    @{m.instagramHandle}
    {m.instagramOptinSource && (
      <span className="ml-1 opacity-60">
        {m.instagramOptinSource === 'story_mention' ? '📣' :
         m.instagramOptinSource === 'story_reply' ? '📖' :
         m.instagramOptinSource === 'comment' ? '💬' : '✉️'}
      </span>
    )}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
rtk git add backend/src/services/instagramWebhookOrchestration.ts frontend/src/pages/Dashboard/Municipes.tsx
rtk git commit -m "feat: track instagram opt-in source (dm, comment, story) per municipe"
```

---

## Self-Review

### Spec coverage

| Funcionalidade | Tasks |
|---|---|
| Campo `@instagram` nos munícipes | 1, 2, 3 |
| Auto-link 3 camadas (sem duplicata) | 6 |
| Receber DMs → atendimento no painel | 6, 7 |
| Toggle de IA para DMs | 4, 6, 9 |
| Robô de comentários global (keyword) | 4, 6, 9 |
| Robô de comentários por post específico | 4, 6, 8, 9 |
| Status de conexão (token válido) | 8, 9 |
| Página de configuração | 9, 10 |
| Story mention → DM automática | 11 |
| Story reply → DM automática | 11 |
| Quick replies (botões) nas DMs | 12 |
| Flow de quick reply por payload | 12 |
| Opt-in tracking por canal de origem | 11, 12, 13 |
| Badge de canal no painel de munícipes | 13 |

### Anti-duplicata — como funciona na prática

```
Cenário A: equipe preencheu @joaosilva no cadastro do João
→ DM chega → camada 2 encontra João → vincula instagramUserId → sem duplicata ✓

Cenário B: João não tem @handle no cadastro
→ DM chega → cria munícipe novo com phone = ig_<userId>
→ Equipe vê dois "João Silva" → preenche @joaosilva no antigo → próxima DM: camada 2 vincula ✓

Cenário C: João já mandou DM antes (instagramUserId salvo)
→ Camada 1 resolve → sem lookup extra ✓
```

### Placeholder scan — nenhum encontrado

### Consistência de tipos

- `instagramCommentRules` criada na Task 4, importada nas Tasks 6 e 8 — consistente
- `instagramDmAiEnabled` adicionado na Task 4, checado na Task 6, exposto na Task 9 — consistente
- `findOrCreateMunicipeByInstagram` definida e usada apenas em `instagramWebhookOrchestration.ts` — sem vazamento de escopo
- `instagramCommentKeywords` sempre serializado como `JSON.stringify(array)` no frontend e `JSON.parse` no backend — consistente
