# Follow-up Automático e Relatório Semanal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar follow-up automático de atendimentos pendentes e relatório semanal via WhatsApp para cada gabinete.

**Architecture:** Dois novos cron jobs adicionados ao `automationService.ts` existente (node-cron já instalado). Quatro novos campos no schema `tenants`. Rota `/config/update` estendida. Frontend `CabinetConfig.tsx` com três novos blocos de configuração.

**Tech Stack:** node-cron (já instalado), Drizzle ORM, EvolutionService (já existente), React + Tailwind

---

## File Map

| Ação | Arquivo |
|---|---|
| Modify | `backend/src/db/schema.ts` |
| Modify | `backend/src/services/automationService.ts` |
| Modify | `backend/src/routes/configRoutes.ts` |
| Modify | `frontend/src/pages/Dashboard/CabinetConfig.tsx` |

---

## Task 1: Adicionar campos ao schema

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Adicionar campos na tabela `tenants`**

Em `backend/src/db/schema.ts`, localizar o bloco da tabela `tenants` e adicionar após `legislativeMessage`:

```typescript
  whatsappVereadorNumber: varchar("whatsapp_vereador_number", { length: 50 }),
  followUpEnabled: boolean("follow_up_enabled").default(false).notNull(),
  followUpDays: integer("follow_up_days").default(5).notNull(),
  followUpMessage: varchar("follow_up_message", { length: 2000 }),
```

- [ ] **Step 2: Aplicar migration no banco**

```bash
cd backend
npm run db:push
```

Expected: sem erros, colunas criadas no PostgreSQL.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat: add follow-up and vereador number fields to tenants schema"
```

---

## Task 2: Estender rota de configuração

**Files:**
- Modify: `backend/src/routes/configRoutes.ts`

- [ ] **Step 1: Adicionar os novos campos no PATCH /update**

Em `configRoutes.ts`, substituir o bloco do `router.patch('/update', ...)` atual pelo seguinte:

```typescript
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
    calendarUrl,
    birthdayMessage,
    birthdayAutomated,
    legislativeMessage,
    whatsappVereadorNumber,
    followUpEnabled,
    followUpDays,
    followUpMessage
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
      calendarUrl,
      birthdayMessage,
      birthdayAutomated,
      legislativeMessage,
      whatsappVereadorNumber,
      followUpEnabled,
      followUpDays,
      followUpMessage
    })
    .where(eq(tenants.id, tenantId));
    
  res.json({ success: true });
});
```

- [ ] **Step 2: Verificar compilação**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/configRoutes.ts
git commit -m "feat: extend config/update route with follow-up and vereador number fields"
```

---

## Task 3: Job de follow-up automático

**Files:**
- Modify: `backend/src/services/automationService.ts`

- [ ] **Step 1: Adicionar imports necessários**

No topo de `automationService.ts`, atualizar os imports:

```typescript
import cron from 'node-cron';
import { db } from '../db';
import { tenants, municipes, atendimentos } from '../db/schema';
import { eq, sql, and, lt } from 'drizzle-orm';
import { EvolutionService } from './evolutionService';
```

- [ ] **Step 2: Registrar o novo job no `initAutomations`**

Dentro de `initAutomations()`, após o job de aniversário existente, adicionar:

```typescript
  // Todo dia às 09:00 — follow-up de atendimentos pendentes
  cron.schedule('0 9 * * *', async () => {
    console.log('[AUTOMATION] Iniciando follow-up de atendimentos às 09:00...');
    await processFollowUpAutomations();
  }, { timezone: 'America/Sao_Paulo' });
```

- [ ] **Step 3: Implementar `processFollowUpAutomations`**

Adicionar a função após `processBirthdayAutomations`:

```typescript
const processFollowUpAutomations = async () => {
  try {
    const allTenants = await db.select().from(tenants).where(
      and(eq(tenants.active, true), eq(tenants.followUpEnabled, true))
    );

    for (const tenant of allTenants) {
      if (!tenant.whatsappInstanceId || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken) {
        continue;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - tenant.followUpDays);

      const pendingAtendimentos = await db
        .select({
          id: atendimentos.id,
          municipeName: municipes.name,
          municipePhone: municipes.phone,
        })
        .from(atendimentos)
        .innerJoin(municipes, eq(atendimentos.municipeId, municipes.id))
        .where(
          and(
            eq(atendimentos.tenantId, tenant.id),
            eq(atendimentos.precisaRetorno, true),
            lt(atendimentos.updatedAt, cutoffDate)
          )
        );

      if (pendingAtendimentos.length === 0) continue;

      const DEFAULT_FOLLOWUP_MSG = 'Olá {nome}, passamos para informar que sua solicitação está sendo acompanhada pelo gabinete. Em breve teremos uma atualização para você. Obrigado pela paciência!';
      const template = tenant.followUpMessage || DEFAULT_FOLLOWUP_MSG;
      const evolution = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);

      for (const item of pendingAtendimentos) {
        try {
          const message = template.replace(/{nome}/g, item.municipeName);
          const jid = `${item.municipePhone.replace(/\D/g, '')}@s.whatsapp.net`;
          await evolution.sendMessage(tenant.whatsappInstanceId, jid, message);

          // Atualiza updatedAt para não reenviar no próximo ciclo
          await db.update(atendimentos)
            .set({ updatedAt: new Date() })
            .where(eq(atendimentos.id, item.id));

          console.log(`[FOLLOW-UP] Enviado para ${item.municipeName} (${tenant.name})`);
        } catch (err) {
          console.error(`[FOLLOW-UP] Erro ao enviar para ${item.municipeName}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[FOLLOW-UP] Erro crítico:', error);
  }
};
```

- [ ] **Step 4: Verificar compilação**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/automationService.ts
git commit -m "feat: add follow-up automation job — daily 09h for pending atendimentos"
```

---

## Task 4: Job de relatório semanal

**Files:**
- Modify: `backend/src/services/automationService.ts`

- [ ] **Step 1: Registrar o job semanal no `initAutomations`**

Dentro de `initAutomations()`, após o job de follow-up, adicionar:

```typescript
  // Toda segunda-feira às 08:00 — relatório semanal
  cron.schedule('0 8 * * 1', async () => {
    console.log('[AUTOMATION] Iniciando relatório semanal às 08:00 de segunda...');
    await processWeeklyReport();
  }, { timezone: 'America/Sao_Paulo' });
```

- [ ] **Step 2: Implementar `processWeeklyReport`**

Adicionar a função após `processFollowUpAutomations`:

```typescript
const processWeeklyReport = async () => {
  try {
    const allTenants = await db.select().from(tenants).where(eq(tenants.active, true));

    for (const tenant of allTenants) {
      const hasNotification = tenant.whatsappNotificationNumber || tenant.whatsappVereadorNumber;
      if (!tenant.whatsappInstanceId || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken || !hasNotification) {
        continue;
      }

      // Datas da semana anterior
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      // Atendimentos na semana
      const [atendimentoCount] = await db.select({
        total: sql<number>`count(*)::int`
      }).from(atendimentos).where(
        and(
          eq(atendimentos.tenantId, tenant.id),
          sql`${atendimentos.createdAt} >= ${weekStart}`
        )
      );

      // Indicações na semana (demandas com isLegislativo = true)
      const { demandas } = await import('../db/schema');
      const [indicacoesCount] = await db.select({
        total: sql<number>`count(*)::int`
      }).from(demandas).where(
        and(
          eq(demandas.tenantId, tenant.id),
          eq(demandas.isLegislativo, true),
          sql`${demandas.createdAt} >= ${weekStart}`
        )
      );

      // Aniversariantes nos próximos 7 dias
      const [birthdayCount] = await db.select({
        total: sql<number>`count(*)::int`
      }).from(municipes).where(
        and(
          eq(municipes.tenantId, tenant.id),
          sql`to_char(${municipes.birthDate}, 'DD-MM') IN (
            SELECT to_char(CURRENT_DATE + s.a, 'DD-MM')
            FROM generate_series(0, 6) AS s(a)
          )`
        )
      );

      // Bairro mais ativo na semana
      const bairroResult = await db.select({
        bairro: municipes.bairro,
        total: sql<number>`count(*)::int`
      })
      .from(atendimentos)
      .innerJoin(municipes, eq(atendimentos.municipeId, municipes.id))
      .where(
        and(
          eq(atendimentos.tenantId, tenant.id),
          sql`${atendimentos.createdAt} >= ${weekStart}`,
          sql`${municipes.bairro} is not null`
        )
      )
      .groupBy(municipes.bairro)
      .orderBy(sql`count(*) desc`)
      .limit(1);

      const bairroAtivo = bairroResult[0]?.bairro || 'Não identificado';

      const weekStartStr = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const weekEndStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      const message = [
        `📊 *Relatório Semanal do Gabinete*`,
        `Semana de ${weekStartStr} a ${weekEndStr}`,
        ``,
        `🗣️ Atendimentos na semana: ${atendimentoCount?.total || 0}`,
        `📋 Indicações realizadas: ${indicacoesCount?.total || 0}`,
        `🎂 Aniversariantes nos próximos 7 dias: ${birthdayCount?.total || 0}`,
        `📍 Bairro mais ativo: ${bairroAtivo}`,
        ``,
        `_Enviado automaticamente pelo CRM Verê_`
      ].join('\n');

      const evolution = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);

      const recipients = [
        tenant.whatsappNotificationNumber,
        tenant.whatsappVereadorNumber
      ].filter(Boolean) as string[];

      // Remover duplicatas caso os dois números sejam iguais
      const uniqueRecipients = [...new Set(recipients.map(n => n.replace(/\D/g, '')))];

      for (const number of uniqueRecipients) {
        try {
          const jid = `${number}@s.whatsapp.net`;
          await evolution.sendMessage(tenant.whatsappInstanceId, jid, message);
          console.log(`[WEEKLY-REPORT] Enviado para ${number} (${tenant.name})`);
        } catch (err) {
          console.error(`[WEEKLY-REPORT] Erro ao enviar para ${number}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[WEEKLY-REPORT] Erro crítico:', error);
  }
};
```

- [ ] **Step 3: Verificar compilação**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/automationService.ts
git commit -m "feat: add weekly report job — every Monday 08h via WhatsApp"
```

---

## Task 5: Frontend — CabinetConfig

**Files:**
- Modify: `frontend/src/pages/Dashboard/CabinetConfig.tsx`

- [ ] **Step 1: Atualizar o estado inicial `config`**

Localizar o `useState` do `config` no componente e adicionar os novos campos:

```typescript
const DEFAULT_FOLLOWUP = "Olá {nome}, passamos para informar que sua solicitação está sendo acompanhada pelo gabinete. Em breve teremos uma atualização para você. Obrigado pela paciência!";

// Dentro do useState config, adicionar após legislativeMessage:
whatsappVereadorNumber: '',
followUpEnabled: false,
followUpDays: 5,
followUpMessage: '',
```

- [ ] **Step 2: Preencher os novos campos no `useEffect` que carrega os dados**

No `.then(res => { setConfig({ ... }) })` do `useEffect`, adicionar após `legislativeMessage`:

```typescript
whatsappVereadorNumber: res.data.whatsappVereadorNumber || '',
followUpEnabled: res.data.followUpEnabled || false,
followUpDays: res.data.followUpDays || 5,
followUpMessage: res.data.followUpMessage || DEFAULT_FOLLOWUP,
```

- [ ] **Step 3: Incluir campos no `handleSave`**

Na chamada `api.patch('/config/update', { ... })` do `handleSave`, incluir os novos campos no payload:

```typescript
whatsappVereadorNumber: config.whatsappVereadorNumber,
followUpEnabled: config.followUpEnabled,
followUpDays: config.followUpDays,
followUpMessage: config.followUpMessage,
```

- [ ] **Step 4: Adicionar bloco "Número do Vereador" no JSX**

Localizar o bloco que contém o campo `fotoUrl` ou `calendarUrl` e adicionar após ele um novo bloco de seção. Usar o mesmo padrão visual dos blocos existentes:

```tsx
{/* Número do Vereador */}
<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
  <div className="flex items-center gap-3 mb-2">
    <div className="bg-green-50 p-2 rounded-xl"><Smartphone className="text-green-600" size={20} /></div>
    <div>
      <h3 className="font-black text-slate-900">Número do Vereador</h3>
      <p className="text-xs text-slate-400">Recebe o relatório semanal pessoalmente</p>
    </div>
  </div>
  <div>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">WhatsApp do Vereador</label>
    <input
      type="text"
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="5511999999999"
      value={config.whatsappVereadorNumber}
      onChange={e => setConfig({ ...config, whatsappVereadorNumber: e.target.value })}
    />
    <p className="text-[10px] text-slate-400 mt-1">Formato: código país + DDD + número (ex: 5511999999999)</p>
  </div>
</div>
```

- [ ] **Step 5: Adicionar bloco "Follow-up Automático" no JSX**

Após o bloco do número do vereador:

```tsx
{/* Follow-up Automático */}
<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
  <div className="flex items-center gap-3 mb-2">
    <div className="bg-blue-50 p-2 rounded-xl"><MessageSquare className="text-blue-600" size={20} /></div>
    <div>
      <h3 className="font-black text-slate-900">Follow-up Automático</h3>
      <p className="text-xs text-slate-400">Lembra o cidadão que a solicitação está sendo tratada</p>
    </div>
  </div>
  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
    <span className="text-sm font-black text-slate-700 uppercase tracking-tighter">Ativar Follow-up Automático</span>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={config.followUpEnabled}
        onChange={e => setConfig({ ...config, followUpEnabled: e.target.checked })}
      />
      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
  </div>
  {config.followUpEnabled && (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Dias sem resposta para disparar</label>
        <input
          type="number"
          min={1}
          max={30}
          className="w-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          value={config.followUpDays}
          onChange={e => setConfig({ ...config, followUpDays: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mensagem de follow-up</label>
        <textarea
          rows={4}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          value={config.followUpMessage}
          onChange={e => setConfig({ ...config, followUpMessage: e.target.value })}
        />
        <p className="text-[10px] text-slate-400 mt-1">Use <strong>{'{nome}'}</strong> para inserir o nome do cidadão</p>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 6: Adicionar bloco informativo "Relatório Semanal" no JSX**

Após o bloco de follow-up:

```tsx
{/* Relatório Semanal */}
<div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
  <div className="flex items-center gap-3 mb-3">
    <div className="bg-indigo-50 p-2 rounded-xl"><Sparkles className="text-indigo-600" size={20} /></div>
    <div>
      <h3 className="font-black text-slate-900">Relatório Semanal</h3>
      <p className="text-xs text-slate-400">Enviado automaticamente toda segunda-feira às 08h</p>
    </div>
  </div>
  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
    <p className="text-xs text-indigo-800 font-bold">
      O relatório inclui: atendimentos da semana, indicações realizadas, aniversariantes nos próximos 7 dias e bairro mais ativo.
      É enviado para o número da equipe e para o número do vereador cadastrados acima.
    </p>
  </div>
</div>
```

- [ ] **Step 7: Verificar compilação frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Dashboard/CabinetConfig.tsx
git commit -m "feat: add follow-up and weekly report config fields in CabinetConfig"
```

---

## Task 6: Push final

- [ ] **Step 1: Push para o GitHub**

```bash
git push
```

Expected: branch `main` atualizada com todos os commits das tasks 1–5.
