# Expansão CRM Vereador — 3 Features

**Data:** 2026-04-20
**Escopo:** Atribuição de Demandas + Disparo em Massa + Prestação de Contas (PDF)

## Ordem de execução

As features foram ordenadas por **dependência** e **velocidade de entrega**:

1. **FASE 1 — Atribuição de Demandas** (2-3 dias)
   Base para as outras: sem `assignedTo` a prestação de contas não mostra produtividade por assessor.

2. **FASE 2 — Disparo em Massa** (4-5 dias)
   Requer fila/rate-limit. Independente da fase 1 tecnicamente, mas reaproveita filtros de segmentação.

3. **FASE 3 — Prestação de Contas PDF** (3-4 dias)
   Consome dados das duas fases anteriores (demandas atribuídas, campanhas disparadas).

---

# FASE 1 — Atribuição de Demandas

## Objetivo
Assessor vê "minhas tarefas", admin distribui demandas, SLA alerta vencimentos.

## 1.1 Schema (drizzle migration)

Alteração em `demandas`:
```ts
assignedToId: uuid("assigned_to_id").references(() => users.id),
assignedAt: timestamp("assigned_at"),
dueDate: timestamp("due_date"),
closedAt: timestamp("closed_at"),
```

Nova tabela `demand_comments` (histórico de trabalho na demanda):
```ts
demandId, userId, comment (varchar 2000), createdAt
```

Nova tabela `demand_activity_log` (audit trail):
```ts
demandId, userId, action (assigned|status_changed|commented), oldValue, newValue, createdAt
```

Migration: `0012_demand_assignment.sql`

## 1.2 Backend

**`demandRoutes.ts` — novos endpoints:**
- `PATCH /api/demands/:id/assign` — body `{ userId }` — atribui a assessor
- `PATCH /api/demands/:id/status` — muda status e preenche `closedAt` se concluída
- `POST /api/demands/:id/comments` — adiciona comentário
- `GET /api/demands/:id/timeline` — retorna comments + activity_log ordenados
- `GET /api/demands/my` — filtra `assignedToId = req.user.id`
- `GET /api/demands?overdue=true` — demandas com `dueDate < now()` e status ≠ concluida

**`demandController.ts` — lógica:**
- Ao atribuir: registrar em `activity_log`, notificar assessor (via WhatsApp do gabinete se tiver número)
- Ao mudar status: registrar em `activity_log`

**`automationService.ts` — novo cron job:**
- Diariamente às 9h: buscar demandas com `dueDate` vencendo em 24h ou vencidas → mensagem WhatsApp para responsável

## 1.3 Frontend

**`pages/Dashboard/Demands.tsx` — alterações:**
- Coluna "Responsável" na lista com avatar/nome
- Filtro: "Todas | Minhas | Sem responsável | Vencidas"
- Badge vermelho em vencidas

**`components/DemandModal.tsx` — alterações:**
- Select "Atribuir a" (lista de users do tenant via `/api/team`)
- Campo "Prazo" (date picker)
- Aba "Timeline" (comentários + histórico)
- Campo de comentário na aba Timeline

**Nova página `pages/Dashboard/MyTasks.tsx`** (atalho para assessor):
- Sidebar: adicionar item "Minhas Tarefas" (ícone `ListTodo`)
- Mostra só demandas atribuídas ao user logado, agrupadas por status

## 1.4 Critérios de pronto
- [ ] Admin consegue atribuir demanda a assessor e vê histórico
- [ ] Assessor loga e vê "Minhas Tarefas" com contador
- [ ] Demanda vencida gera notificação WhatsApp no dia seguinte
- [ ] Timeline mostra todas mudanças de status/atribuição

---

# FASE 2 — Disparo em Massa Segmentado

## Objetivo
Compor mensagem WhatsApp, selecionar segmento (bairro, lideranças, aniversariantes, etc.), enviar com rate-limit e acompanhar entrega.

## 2.1 Schema

Nova tabela `broadcasts`:
```ts
id, tenantId, name, message (varchar 4000),
mediaUrl (varchar 500, null),
segmentType (enum: bairro|lideranca|aniversariantes|categoria_demanda|custom|todos),
segmentValue (varchar 255), // ex: "Centro", "saude"
status (enum: rascunho|enfileirado|enviando|concluido|cancelado),
totalRecipients, sentCount, failedCount,
scheduledFor (timestamp null),
createdBy (userId),
createdAt, startedAt, completedAt
```

Nova tabela `broadcast_recipients`:
```ts
broadcastId, municipeId, phone,
status (enum: pendente|enviado|erro|opt_out),
errorMessage, sentAt
```

Nova tabela `optouts` (LGPD):
```ts
tenantId, phone, reason (varchar 255), createdAt
UNIQUE(tenantId, phone)
```

Migration: `0013_broadcasts_optouts.sql`

## 2.2 Backend

**Novo arquivo `routes/broadcastRoutes.ts`:**
- `POST /api/broadcasts` — cria rascunho
- `GET /api/broadcasts/:id/preview` — calcula recipients do segmento (não grava ainda)
- `POST /api/broadcasts/:id/send` — materializa recipients, enfileira, muda status para `enfileirado`
- `POST /api/broadcasts/:id/cancel` — para envio em andamento
- `GET /api/broadcasts` — lista com filtros
- `GET /api/broadcasts/:id` — detalhes + progresso

**Novo `services/broadcastService.ts`:**
- `resolveSegment(tenantId, segmentType, segmentValue)` → array de municipes
  - `bairro`: filtra por bairro
  - `lideranca`: `isLideranca = true`
  - `aniversariantes`: birthDate no mês atual
  - `categoria_demanda`: munícipes com demanda da categoria X nos últimos 90 dias
  - `custom`: ids explícitos
  - `todos`: todos do tenant
  - Sempre excluir quem está em `optouts`
- `queueBroadcast(broadcastId)` — popula `broadcast_recipients`
- `processQueue()` — cron a cada 30s: pega próximos 10 pendentes, envia via Evolution com delay de 3-5s entre mensagens (anti-ban), atualiza status
- Detectar resposta "sair"/"parar"/"stop" no webhook → inserir em `optouts`

**Alteração em `webhookController.ts`:**
- Se mensagem inbound contém palavra de opt-out → gravar em `optouts` e responder confirmação

**`automationService.ts`:**
- Cron `*/30 * * * * *` chamando `processQueue`

## 2.3 Frontend

**Nova página `pages/Dashboard/Broadcasts.tsx`:**
- Lista de disparos (tabela: nome, segmento, enviados/total, status, data)
- Botão "Novo Disparo"

**Novo componente `BroadcastModal.tsx`:**
- Step 1: mensagem (textarea) + upload de mídia opcional
- Step 2: segmento
  - Radio: Todos | Bairro | Liderança | Aniversariantes | Categoria | Custom
  - Campo dinâmico conforme seleção (ex: select de bairros)
- Step 3: preview — mostra "X munícipes serão atingidos" com lista dos primeiros 20
- Step 4: agendamento (agora ou data futura) + confirmação

**Nova página `pages/Dashboard/BroadcastDetail.tsx`:**
- Barra de progresso (enviados/total)
- Tabela de recipients com status (pendente, enviado, erro, opt-out)
- Botão "Cancelar" se em andamento
- Botão "Reenviar falhas"

**Sidebar:** adicionar "Disparo em Massa" (ícone `Megaphone`)

## 2.4 Critérios de pronto
- [ ] Criar disparo, escolher segmento "Bairro: Centro", pré-visualizar 30 contatos
- [ ] Enviar e acompanhar progresso em tempo real (polling 5s)
- [ ] Rate-limit 3-5s entre mensagens respeitado
- [ ] Resposta "sair" cadastra opt-out e filtra de disparos futuros
- [ ] Disparo agendado para amanhã 9h dispara no horário

---

# FASE 3 — Prestação de Contas (PDF)

## Objetivo
Relatório mensal/trimestral/anual em PDF profissional que o vereador manda para eleitores e coloca em redes sociais.

## 3.1 Schema

Nova tabela `reports`:
```ts
id, tenantId, title,
periodStart, periodEnd,
reportType (enum: mensal|trimestral|anual|custom),
fileUrl (varchar 500),
createdBy (userId),
createdAt
```

Migration: `0014_reports.sql`

## 3.2 Backend

**Dependência nova:** `pdfkit` ou `puppeteer` (recomendo puppeteer — HTML/CSS é mais fácil de estilizar bonito)

**Novo `routes/reportRoutes.ts`:**
- `POST /api/reports/generate` — body `{ reportType, periodStart, periodEnd, title }` — gera assíncrono
- `GET /api/reports` — lista relatórios do tenant
- `GET /api/reports/:id/download` — stream do PDF
- `DELETE /api/reports/:id`

**Novo `services/reportService.ts`:**
- `collectReportData(tenantId, start, end)` retorna:
  - Total de demandas abertas, em andamento, concluídas no período
  - Demandas por bairro (top 10)
  - Demandas por categoria (pizza)
  - Top 5 assessores por demandas concluídas
  - Indicações legislativas protocoladas (lista com número e data)
  - Eventos realizados (agenda)
  - Disparos feitos no período (alcance total)
  - Comparativo com período anterior (% crescimento)
- `renderReportHtml(data)` → template HTML com logo do gabinete, cores do partido, gráficos (Chart.js server-side ou SVG inline)
- `generatePdf(html)` → puppeteer headless → buffer → salvar em `uploads/reports/`

**Template HTML:** `backend/src/templates/report.html`
Seções:
1. Capa com foto/nome do vereador, mandato, período
2. Resumo executivo (4 KPIs grandes)
3. Atendimentos por bairro (gráfico de barras)
4. Distribuição por categoria (pizza)
5. Indicações protocoladas (lista numerada com links)
6. Ações de gabinete (agenda)
7. Alcance de comunicação (disparos)
8. Assinatura com contato

## 3.3 Frontend

**Nova página `pages/Dashboard/Reports.tsx`:**
- Lista de relatórios já gerados
- Botão "Gerar Novo Relatório"

**Novo componente `GenerateReportModal.tsx`:**
- Select tipo: Mensal | Trimestral | Anual | Custom
- Se custom: date pickers de/até
- Preview das seções incluídas (checkbox, default tudo marcado)
- Botão "Gerar" → mostra loading → download automático quando pronto

**Sidebar:** adicionar "Prestação de Contas" (ícone `FileText`)

## 3.4 Critérios de pronto
- [ ] Vereador clica "Gerar Relatório Mensal" e recebe PDF em <30s
- [ ] PDF tem capa com foto, 6 seções com gráficos, está legível e com cara profissional
- [ ] Dados batem com o que aparece nos dashboards
- [ ] Relatório anterior fica salvo e pode ser baixado de novo

---

# Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Ban do WhatsApp no disparo em massa | Rate-limit 3-5s + variação aleatória + opt-out automático + limite diário (ex: 200/dia por instância) |
| Puppeteer pesado no servidor | Reaproveitar instância browser; gerar em fila separada; fallback para pdfkit se timeout |
| Demandas antigas sem `assignedTo` | Campo nullable + migração sem backfill; UI filtra "sem responsável" |
| LGPD em disparos | Opt-out automático + campo de consentimento no cadastro do munícipe (fase 2) |

# Checklist geral

- [ ] Fase 1 — Atribuição: schema + backend + frontend + cron SLA
- [ ] Fase 2 — Disparos: schema + service + queue + frontend + opt-out
- [ ] Fase 3 — Relatório: puppeteer + template + service + frontend
- [ ] Testes de integração para cada fase
- [ ] Atualizar `docs/PROPOSTA_COMERCIAL_CRM_VERE.md` com novas features (pitch)
