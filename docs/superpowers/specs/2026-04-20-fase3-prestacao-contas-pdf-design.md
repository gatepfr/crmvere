# Fase 3 — Prestação de Contas (PDF) — Design Spec

**Data:** 2026-04-20  
**Status:** Aprovado

---

## Visão Geral

Gera um relatório mensal/trimestral/anual/custom em PDF profissional on-demand. O vereador seleciona o período, clica em "Gerar PDF", e o browser baixa automaticamente o arquivo. Sem persistência — cada clique gera e descarta.

---

## Arquitetura

```
Frontend                    Backend
────────────────────────    ─────────────────────────────────────
Reports.tsx                 reportRoutes.ts
  └─ ReportModal.tsx     →    POST /api/reports/generate
       └─ loading spinner       └─ reportService.ts
            └─ download auto         ├─ coleta dados (DB queries)
                                     ├─ monta HTML template + SVG
                                     └─ puppeteer-core → PDF buffer → stream
```

**Endpoint:** `POST /api/reports/generate`  
**Body:** `{ startDate: string (ISO), endDate: string (ISO), type: 'mensal' | 'trimestral' | 'anual' | 'custom' }`  
**Response:** `Content-Type: application/pdf` com buffer direto (streaming)

---

## Novos Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `backend/src/services/reportService.ts` | Coleta dados do DB, monta HTML template com SVGs, gera PDF via puppeteer-core |
| `backend/src/routes/reportRoutes.ts` | `POST /api/reports/generate` — autentica, valida body, chama service, faz stream do PDF |
| `frontend/src/pages/Dashboard/Reports.tsx` | Página principal com card de introdução + atalhos de tipo |
| `frontend/src/components/ReportModal.tsx` | Modal de seleção de período + loading + trigger de download |

---

## Dados Coletados (reportService)

| Fonte | Dados |
|-------|-------|
| `tenants` | nome, fotoUrl, municipio, uf, partido, mandato |
| `demandas` (período) | total, por status (nova/em_andamento/concluida/cancelada) |
| `demandas` agrupadas por `municipes.bairro` | top 10 bairros com mais demandas |
| `demandas` agrupadas por `categoria` | todas as categorias com contagem |
| `demandas` com `isLegislativo = true` | lista de indicações: numeroIndicacao, descricao, status, createdAt |
| `municipes` | total cadastrados no tenant |
| `broadcasts` (período, status = 'concluido') | soma de `sentCount` |

Todos os dados são filtrados por `tenantId` e pelo intervalo `[startDate, endDate]`.

---

## Estrutura do PDF (8 seções)

| # | Seção | Conteúdo |
|---|-------|----------|
| 1 | Capa | Foto do vereador, nome, partido, município/UF, mandato, período do relatório |
| 2 | Resumo Executivo | 4 KPIs: total demandas, concluídas, munícipes atendidos, mensagens disparadas |
| 3 | Demandas por Bairro | Barras horizontais SVG — top 10 bairros |
| 4 | Demandas por Categoria | Barras horizontais SVG — todas as categorias |
| 5 | Status das Demandas | Mini KPIs: nova / em andamento / concluída / cancelada |
| 6 | Indicações Protocoladas | Tabela com nº indicação, descrição (truncada), data, status |
| 7 | Alcance de Comunicação | Total munícipes cadastrados + mensagens disparadas no período |
| 8 | Rodapé | Data de geração + "Relatório gerado pelo VereDoc" |

Gráficos implementados como SVG puro embutido no HTML (sem Chart.js, sem dependência de JS runtime).

---

## Frontend UX

**`Reports.tsx`:**
- Card descritivo + botão "Gerar Relatório"
- Atalhos rápidos: Mensal, Trimestral, Anual (pré-calculam startDate/endDate)
- Entrada no menu Sidebar: "Prestação de Contas" com ícone `FileText`
- Rota: `/dashboard/reports`

**`ReportModal.tsx`:**
- Step 1: 4 botões de tipo (Mensal / Trimestral / Anual / Personalizado)
- Step 2 (apenas Custom): date pickers para início e fim
- Botão "Gerar PDF" → `POST /api/reports/generate` com `responseType: 'blob'`
- Loading spinner: "Gerando relatório..." durante a requisição
- Download automático via `URL.createObjectURL` + `<a>.click()`
- Modal fecha após download
- Erro: toast "Erro ao gerar relatório. Tente novamente."

---

## Puppeteer — Configuração

- Usa `puppeteer-core` (já adicionado ao `package.json`)
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (já configurado no Dockerfile)
- Lança com `{ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true }`
- Fecha o browser após cada geração (sem reuso entre requests)
- Formato: A4, margens 15mm, `printBackground: true`

---

## Tratamento de Erros

- Se `fotoUrl` não existir no tenant: capa renderiza placeholder cinza
- Se não houver demandas no período: seções de gráfico exibem "Sem dados no período"
- Se Puppeteer falhar: rota retorna `500` com JSON `{ error: 'Erro ao gerar PDF' }`
- Timeout da requisição no frontend: 30s (PDFs grandes podem levar até 5s)

---

## Integração no App

- `reportRoutes` registrado em `app.ts` em `/api/reports` (após `checkTenant`)
- Sidebar: novo item "Prestação de Contas" com `FileText` entre "Disparo em Massa" e "Munícipes"
- `App.tsx`: nova rota `/dashboard/reports` → `<Reports />`
