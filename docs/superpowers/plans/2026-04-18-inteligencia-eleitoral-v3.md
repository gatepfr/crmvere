# Plano de Implementação: Inteligência Eleitoral v3 (Estratégia Territorial Ativa)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o motor de inteligência que identifica vácuos eleitorais e orquestra planos de expansão automática (Mailing + Kanban + IA).

**Architecture:** Extensão do schema Drizzle para metas territoriais, criação do `IntelligenceService` para scoring de influência e cruzamento de dados TSE/CRM, e novo Dashboard estratégico no Frontend.

**Tech Stack:** Node.js, TypeScript, Drizzle ORM, PostgreSQL, React, Tailwind CSS.

---

### Task 1: Evolução do Schema (Banco de Dados)

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/drizzle/0011_territorial_intelligence.sql` (Gerado via drizzle-kit)

- [ ] **Step 1: Adicionar tabelas territorial_goals e territorial_intelligence_actions**
```typescript
export const territorialGoals = pgTable("territorial_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  ano: integer("ano").notNull(),
  nmBairro: varchar("nm_bairro", { length: 255 }).notNull(),
  metaVotos: integer("meta_votos").default(0),
  metaContatos: integer("meta_contatos").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const intelligenceActionTypeEnum = pgEnum("intelligence_action_type", ["vacuo", "meta_nao_batida"]);
export const intelligenceActionStatusEnum = pgEnum("intelligence_action_status", ["pendente", "executada"]);

export const territorialIntelligenceActions = pgTable("territorial_intelligence_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  nmBairro: varchar("nm_bairro", { length: 255 }).notNull(),
  tipoAcao: intelligenceActionTypeEnum("tipo_acao").notNull(),
  status: intelligenceActionStatusEnum("status").default("pendente").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Gerar migração**
```bash
cd backend
npx drizzle-kit generate
```

- [ ] **Step 3: Aplicar migração**
```bash
cd backend
npx drizzle-kit push
```

- [ ] **Step 4: Commit**
```bash
git add backend/src/db/schema.ts
git commit -m "db: add territorial intelligence tables (goals and actions)"
```

---

### Task 2: Motor de Scoring de Influência (IntelligenceService)

**Files:**
- Create: `backend/src/services/intelligenceService.ts`
- Create: `backend/src/__tests__/intelligenceService.test.ts`

- [ ] **Step 1: Criar o serviço de Inteligência com lógica de scoring**
```typescript
import { db } from '../db';
import { atendimentos, municipes } from '../db/schema';
import { eq, sql, count } from 'drizzle-orm';

export const calculateInfluenceScore = (atendimentosCount: number, isLideranca: boolean) => {
  let score = atendimentosCount * 10;
  if (isLideranca) score += 50;
  return score;
};

export const getInfluentialMunicipes = async (tenantId: string, bairro: string) => {
  // Query que busca munícipes do bairro, conta atendimentos concluídos e aplica o score
};
```

- [ ] **Step 2: Escrever testes unitários para o scoring**
```typescript
import { calculateInfluenceScore } from '../services/intelligenceService';

describe('IntelligenceService - Scoring', () => {
  test('should calculate correct score for leaders', () => {
    expect(calculateInfluenceScore(2, true)).toBe(70);
  });
});
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/intelligenceService.ts backend/src/__tests__/intelligenceService.test.ts
git commit -m "feat: implement influence scoring in IntelligenceService"
```

---

### Task 3: Motor de Vácuo Eleitoral

**Files:**
- Modify: `backend/src/services/intelligenceService.ts`

- [ ] **Step 1: Implementar lógica de cruzamento TSE vs CRM**
```typescript
export const identifyTerritorialVacuums = async (tenantId: string) => {
  // 1. Pega votos por bairro (TSE)
  // 2. Pega contatos por bairro (CRM)
  // 3. Retorna bairros onde Votos > 500 e CRM/Votos < 0.10
};
```

- [ ] **Step 2: Commit**
```bash
git add backend/src/services/intelligenceService.ts
git commit -m "feat: add vacuum identification logic"
```

---

### Task 4: Orquestrador de Expansão (Combo D)

**Files:**
- Modify: `backend/src/services/intelligenceService.ts`
- Create: `backend/src/controllers/intelligenceController.ts`
- Create: `backend/src/routes/intelligenceRoutes.ts`

- [ ] **Step 1: Implementar função executeExpansionPlan**
Deve criar tarefa no Kanban, sugerir conteúdo via IA e preparar mailing.

- [ ] **Step 2: Criar rotas de API para o Dashboard**
`GET /intelligence/summary`
`POST /intelligence/action/execute`

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/intelligenceService.ts backend/src/controllers/intelligenceController.ts backend/src/routes/intelligenceRoutes.ts
git commit -m "feat: implement expansion plan orchestrator and routes"
```

---

### Task 5: Dashboard Estratégico (Frontend)

**Files:**
- Create: `frontend/src/pages/Intelligence/Dashboard.tsx`
- Create: `frontend/src/components/Intelligence/VacuumCard.tsx`

- [ ] **Step 1: Implementar visualização de Vácuos Críticos**
- [ ] **Step 2: Integrar botão de execução de Plano de Ação**

- [ ] **Step 3: Commit**
```bash
git add frontend/src/pages/Intelligence/Dashboard.tsx
git commit -m "feat: add strategic intelligence dashboard UI"
```
