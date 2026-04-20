# Fase 3 — Prestação de Contas (PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar relatório PDF on-demand de prestação de contas com dados do período (demandas, indicações, comunicação), baixado automaticamente pelo browser do vereador.

**Architecture:** `POST /api/reports/generate` recebe `{ startDate, endDate, type }`, chama `reportService` que consulta o banco, monta HTML com SVGs embutidos, e usa `puppeteer-core` para gerar o PDF. A rota faz stream do buffer direto com `Content-Type: application/pdf`. Frontend tem modal com seletor de período e dispara download automático.

**Tech Stack:** TypeScript, Express, Drizzle ORM, puppeteer-core, React, Tailwind CSS, Axios (blob responseType)

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/src/services/reportService.ts` | Criar | Coleta dados do DB, gera SVGs, monta HTML template, chama puppeteer |
| `backend/src/routes/reportRoutes.ts` | Criar | POST /api/reports/generate — valida, chama service, stream PDF |
| `backend/src/app.ts` | Modificar | Registrar `/api/reports` |
| `backend/src/__tests__/reportService.test.ts` | Criar | Testa buildSvgBars e calcDateRange |
| `frontend/src/components/ReportModal.tsx` | Criar | Modal de seleção de período + loading + download |
| `frontend/src/pages/Dashboard/Reports.tsx` | Criar | Página principal com atalhos de tipo |
| `frontend/src/App.tsx` | Modificar | Adicionar rota `/dashboard/reports` |
| `frontend/src/components/Sidebar.tsx` | Modificar | Adicionar "Prestação de Contas" no menu |

---

## Task 1: Instalar puppeteer-core no backend

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Instalar a dependência**

No diretório `backend/`:
```bash
cd backend && npm install puppeteer-core@^24.0.0
```

Expected output: `added 1 package` (ou similar, sem erros)

- [ ] **Step 2: Verificar que foi adicionado**

```bash
grep puppeteer-core backend/package.json
```

Expected: `"puppeteer-core": "^24.0.0"` aparece em `dependencies`

- [ ] **Step 3: Commit**

```bash
cd backend && git add package.json package-lock.json
git commit -m "chore: install puppeteer-core for PDF generation"
```

---

## Task 2: Criar reportService.ts — funções puras (SVG + datas)

**Files:**
- Create: `backend/src/services/reportService.ts` (apenas funções puras neste task)
- Create: `backend/src/__tests__/reportService.test.ts`

- [ ] **Step 1: Escrever os testes das funções puras**

Crie o arquivo `backend/src/__tests__/reportService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSvgBars, calcDateRange } from '../services/reportService';

describe('buildSvgBars', () => {
  it('returns empty message when data is empty', () => {
    const result = buildSvgBars([]);
    expect(result).toContain('Sem dados no período');
  });

  it('renders one bar per item', () => {
    const data = [
      { label: 'Centro', value: 10 },
      { label: 'Vila Nova', value: 5 },
    ];
    const result = buildSvgBars(data);
    expect(result).toContain('Centro');
    expect(result).toContain('Vila Nova');
    expect(result.match(/<rect/g)?.length).toBe(2);
  });

  it('scales bars proportionally to max value', () => {
    const data = [{ label: 'A', value: 100 }, { label: 'B', value: 50 }];
    const result = buildSvgBars(data);
    // A deve ter width="400" (100%), B deve ter width="200" (50%)
    expect(result).toContain('width="400"');
    expect(result).toContain('width="200"');
  });
});

describe('calcDateRange', () => {
  it('mensal: retorna primeiro e último dia do mês atual', () => {
    const { startDate, endDate } = calcDateRange('mensal');
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    expect(startDate).toBe(firstDay.toISOString().split('T')[0]);
    expect(endDate).toBe(lastDay.toISOString().split('T')[0]);
  });

  it('trimestral: retorna 3 meses atrás até hoje', () => {
    const { startDate, endDate } = calcDateRange('trimestral');
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    expect(startDate).toBe(start.toISOString().split('T')[0]);
    expect(endDate).toBe(now.toISOString().split('T')[0]);
  });

  it('anual: retorna 1 jan até hoje do ano atual', () => {
    const { startDate, endDate } = calcDateRange('anual');
    const now = new Date();
    expect(startDate).toBe(`${now.getFullYear()}-01-01`);
    expect(endDate).toBe(now.toISOString().split('T')[0]);
  });

  it('custom: retorna as datas fornecidas', () => {
    const { startDate, endDate } = calcDateRange('custom', '2026-01-01', '2026-03-31');
    expect(startDate).toBe('2026-01-01');
    expect(endDate).toBe('2026-03-31');
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd backend && npm test -- reportService
```

Expected: FAIL com "Cannot find module '../services/reportService'"

- [ ] **Step 3: Criar reportService.ts com as funções puras**

Crie `backend/src/services/reportService.ts`:

```typescript
import puppeteer from 'puppeteer-core';
import { db } from '../db';
import { tenants, demandas, municipes, broadcasts } from '../db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface BarItem {
  label: string;
  value: number;
}

export function buildSvgBars(data: BarItem[]): string {
  if (data.length === 0) {
    return `<p style="color:#94a3b8;font-style:italic;font-size:13px;">Sem dados no período</p>`;
  }

  const barWidth = 400;
  const rowHeight = 32;
  const max = Math.max(...data.map(d => d.value));
  const height = data.length * rowHeight + 10;

  const bars = data.map((item, i) => {
    const w = max > 0 ? Math.round((item.value / max) * barWidth) : 0;
    const y = i * rowHeight + 6;
    return `
      <g>
        <rect x="140" y="${y}" width="${w}" height="18" rx="4" fill="#3b82f6" opacity="0.85"/>
        <text x="135" y="${y + 13}" text-anchor="end" font-size="11" fill="#475569" font-family="Arial">${item.label}</text>
        <text x="${140 + w + 6}" y="${y + 13}" font-size="11" fill="#334155" font-weight="bold" font-family="Arial">${item.value}</text>
      </g>`;
  }).join('');

  return `<svg width="560" height="${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

export function calcDateRange(
  type: 'mensal' | 'trimestral' | 'anual' | 'custom',
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (type === 'mensal') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: fmt(firstDay), endDate: fmt(lastDay) };
  }

  if (type === 'trimestral') {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    return { startDate: fmt(start), endDate: fmt(now) };
  }

  if (type === 'anual') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: fmt(now) };
  }

  // custom
  return { startDate: customStart!, endDate: customEnd! };
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd backend && npm test -- reportService
```

Expected: PASS — 7 testes verdes

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/reportService.ts backend/src/__tests__/reportService.test.ts
git commit -m "feat: add reportService pure functions — buildSvgBars and calcDateRange"
```

---

## Task 3: Completar reportService.ts — coleta de dados + HTML + puppeteer

**Files:**
- Modify: `backend/src/services/reportService.ts`

- [ ] **Step 1: Adicionar a função `collectReportData` ao final do arquivo**

Adicione ao final de `backend/src/services/reportService.ts`:

```typescript
export interface ReportData {
  tenant: {
    name: string;
    fotoUrl: string | null;
    municipio: string | null;
    uf: string | null;
    partido: string | null;
    mandato: string | null;
  };
  period: { startDate: string; endDate: string };
  totalDemandas: number;
  demandasConcluidas: number;
  demandasNova: number;
  demandasEmAndamento: number;
  demandasCanceladas: number;
  totalMunicipes: number;
  totalMensagensDisparadas: number;
  demandsByBairro: BarItem[];
  demandsByCategoria: BarItem[];
  indicacoes: Array<{
    numeroIndicacao: string | null;
    descricao: string;
    status: string;
    createdAt: Date;
  }>;
}

export async function collectReportData(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<ReportData> {
  const [tenant] = await db
    .select({
      name: tenants.name,
      fotoUrl: tenants.fotoUrl,
      municipio: tenants.municipio,
      uf: tenants.uf,
      partido: tenants.partido,
      mandato: tenants.mandato,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const start = new Date(startDate);
  const end = new Date(endDate + 'T23:59:59');

  const statusCounts = await db
    .select({
      status: demandas.status,
      count: sql<number>`count(*)::int`,
    })
    .from(demandas)
    .where(
      and(
        eq(demandas.tenantId, tenantId),
        gte(demandas.createdAt, start),
        lte(demandas.createdAt, end)
      )
    )
    .groupBy(demandas.status);

  const countMap: Record<string, number> = {};
  statusCounts.forEach(r => { countMap[r.status] = Number(r.count); });
  const totalDemandas = Object.values(countMap).reduce((a, b) => a + b, 0);

  const bairroRows = await db
    .select({
      bairro: municipes.bairro,
      count: sql<number>`count(*)::int`,
    })
    .from(demandas)
    .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
    .where(
      and(
        eq(demandas.tenantId, tenantId),
        gte(demandas.createdAt, start),
        lte(demandas.createdAt, end)
      )
    )
    .groupBy(municipes.bairro)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  const categoriaRows = await db
    .select({
      categoria: demandas.categoria,
      count: sql<number>`count(*)::int`,
    })
    .from(demandas)
    .where(
      and(
        eq(demandas.tenantId, tenantId),
        gte(demandas.createdAt, start),
        lte(demandas.createdAt, end)
      )
    )
    .groupBy(demandas.categoria)
    .orderBy(sql`count(*) desc`);

  const indicacoesRows = await db
    .select({
      numeroIndicacao: demandas.numeroIndicacao,
      descricao: demandas.descricao,
      status: demandas.status,
      createdAt: demandas.createdAt,
    })
    .from(demandas)
    .where(
      and(
        eq(demandas.tenantId, tenantId),
        eq(demandas.isLegislativo, true),
        gte(demandas.createdAt, start),
        lte(demandas.createdAt, end)
      )
    )
    .orderBy(demandas.createdAt);

  const [municipeSummary] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(municipes)
    .where(eq(municipes.tenantId, tenantId));

  const broadcastRows = await db
    .select({ totalSent: sql<number>`coalesce(sum(${broadcasts.sentCount}), 0)::int` })
    .from(broadcasts)
    .where(
      and(
        eq(broadcasts.tenantId, tenantId),
        eq(broadcasts.status, 'concluido'),
        gte(broadcasts.completedAt, start),
        lte(broadcasts.completedAt, end)
      )
    );

  return {
    tenant,
    period: { startDate, endDate },
    totalDemandas,
    demandasConcluidas: countMap['concluida'] ?? 0,
    demandasNova: countMap['nova'] ?? 0,
    demandasEmAndamento: countMap['em_andamento'] ?? 0,
    demandasCanceladas: countMap['cancelada'] ?? 0,
    totalMunicipes: Number(municipeSummary?.total ?? 0),
    totalMensagensDisparadas: Number(broadcastRows[0]?.totalSent ?? 0),
    demandsByBairro: bairroRows
      .filter(r => r.bairro)
      .map(r => ({ label: r.bairro!, value: Number(r.count) })),
    demandsByCategoria: categoriaRows
      .filter(r => r.categoria)
      .map(r => ({ label: r.categoria, value: Number(r.count) })),
    indicacoes: indicacoesRows,
  };
}
```

- [ ] **Step 2: Adicionar a função `buildHtmlTemplate` ao final do arquivo**

```typescript
function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPeriod(startDate: string, endDate: string): string {
  return `${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} a ${new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}

export function buildHtmlTemplate(data: ReportData): string {
  const { tenant, period } = data;

  const kpiCard = (label: string, value: string | number, color: string) => `
    <div style="background:${color}10;border:1px solid ${color}30;border-radius:12px;padding:20px;text-align:center;min-width:130px;flex:1">
      <p style="font-size:32px;font-weight:900;color:${color};margin:0">${value}</p>
      <p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:6px 0 0;font-weight:700">${label}</p>
    </div>`;

  const section = (title: string, content: string) => `
    <div style="margin-bottom:36px">
      <h2 style="font-size:16px;font-weight:900;color:#1e293b;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:20px">${title}</h2>
      ${content}
    </div>`;

  const fotoHtml = tenant.fotoUrl
    ? `<img src="${tenant.fotoUrl}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid white;box-shadow:0 4px 20px rgba(0,0,0,0.2)" />`
    : `<div style="width:120px;height:120px;border-radius:50%;background:#94a3b8;border:4px solid white;display:flex;align-items:center;justify-content:center"><span style="font-size:40px;color:white">👤</span></div>`;

  const indicacoesRows = data.indicacoes.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;font-style:italic;padding:16px">Nenhuma indicação no período</td></tr>`
    : data.indicacoes.map(ind => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 12px;font-size:12px;font-weight:700;color:#3b82f6">${ind.numeroIndicacao ?? '—'}</td>
          <td style="padding:8px 12px;font-size:12px;color:#334155;max-width:300px">${ind.descricao.length > 80 ? ind.descricao.slice(0, 80) + '...' : ind.descricao}</td>
          <td style="padding:8px 12px;font-size:12px;color:#64748b">${formatDate(ind.createdAt)}</td>
          <td style="padding:8px 12px"><span style="background:#f0fdf4;color:#16a34a;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase">${ind.status}</span></td>
        </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1e293b; background: white; }
    @page { margin: 15mm; size: A4; }
  </style>
</head>
<body>

<!-- CAPA -->
<div style="background:linear-gradient(135deg,#1e3a5f 0%,#3b82f6 100%);min-height:280px;border-radius:16px;padding:48px;display:flex;align-items:center;gap:40px;margin-bottom:40px;page-break-after:always">
  <div>${fotoHtml}</div>
  <div style="color:white">
    <p style="font-size:12px;text-transform:uppercase;letter-spacing:3px;opacity:0.7;margin-bottom:8px">Prestação de Contas</p>
    <h1 style="font-size:28px;font-weight:900;margin-bottom:8px">${tenant.name}</h1>
    <p style="font-size:14px;opacity:0.85;margin-bottom:4px">${tenant.partido ?? ''} • ${tenant.municipio ?? ''}${tenant.uf ? '/' + tenant.uf : ''}</p>
    <p style="font-size:13px;opacity:0.75">${tenant.mandato ?? ''}</p>
    <p style="font-size:12px;opacity:0.7;margin-top:16px;border-top:1px solid rgba(255,255,255,0.3);padding-top:16px">Período: ${formatPeriod(period.startDate, period.endDate)}</p>
  </div>
</div>

<!-- RESUMO EXECUTIVO -->
${section('Resumo Executivo', `
  <div style="display:flex;gap:16px;flex-wrap:wrap">
    ${kpiCard('Total de Demandas', data.totalDemandas, '#3b82f6')}
    ${kpiCard('Concluídas', data.demandasConcluidas, '#16a34a')}
    ${kpiCard('Munícipes Atendidos', data.totalMunicipes, '#8b5cf6')}
    ${kpiCard('Mensagens Enviadas', data.totalMensagensDisparadas, '#f59e0b')}
  </div>`)}

<!-- DEMANDAS POR BAIRRO -->
${section('Demandas por Bairro (Top 10)', buildSvgBars(data.demandsByBairro))}

<!-- DEMANDAS POR CATEGORIA -->
${section('Demandas por Categoria', buildSvgBars(data.demandsByCategoria))}

<!-- STATUS DAS DEMANDAS -->
${section('Status das Demandas', `
  <div style="display:flex;gap:16px;flex-wrap:wrap">
    ${kpiCard('Novas', data.demandasNova, '#3b82f6')}
    ${kpiCard('Em Andamento', data.demandasEmAndamento, '#f59e0b')}
    ${kpiCard('Concluídas', data.demandasConcluidas, '#16a34a')}
    ${kpiCard('Canceladas', data.demandasCanceladas, '#ef4444')}
  </div>`)}

<!-- INDICAÇÕES PROTOCOLADAS -->
${section('Indicações Protocoladas', `
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead>
      <tr style="background:#f8fafc">
        <th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Nº Indicação</th>
        <th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Descrição</th>
        <th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Data</th>
        <th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700">Status</th>
      </tr>
    </thead>
    <tbody>${indicacoesRows}</tbody>
  </table>`)}

<!-- ALCANCE DE COMUNICAÇÃO -->
${section('Alcance de Comunicação', `
  <div style="display:flex;gap:16px;flex-wrap:wrap">
    ${kpiCard('Munícipes Cadastrados', data.totalMunicipes, '#3b82f6')}
    ${kpiCard('Mensagens Disparadas no Período', data.totalMensagensDisparadas, '#f59e0b')}
  </div>`)}

<!-- RODAPÉ -->
<div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:20px;text-align:center">
  <p style="font-size:11px;color:#94a3b8">Relatório gerado pelo VereDoc em ${formatDate(new Date())}</p>
</div>

</body>
</html>`;
}
```

- [ ] **Step 3: Adicionar a função `generateReportPdf` ao final do arquivo**

```typescript
export async function generateReportPdf(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<Buffer> {
  const data = await collectReportData(tenantId, startDate, endDate);
  const html = buildHtmlTemplate(data);

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 4: Rodar os testes para confirmar que ainda passam**

```bash
cd backend && npm test -- reportService
```

Expected: PASS — 7 testes verdes

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/reportService.ts
git commit -m "feat: complete reportService with data collection, HTML template, and PDF generation"
```

---

## Task 4: Criar reportRoutes.ts

**Files:**
- Create: `backend/src/routes/reportRoutes.ts`

- [ ] **Step 1: Criar o arquivo da rota**

Crie `backend/src/routes/reportRoutes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { generateReportPdf, calcDateRange } from '../services/reportService';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { type, startDate: customStart, endDate: customEnd } = req.body;

    const validTypes = ['mensal', 'trimestral', 'anual', 'custom'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'type deve ser: mensal, trimestral, anual ou custom' });
    }

    if (type === 'custom' && (!customStart || !customEnd)) {
      return res.status(400).json({ error: 'Para tipo custom, informe startDate e endDate' });
    }

    const { startDate, endDate } = calcDateRange(type, customStart, customEnd);

    const pdfBuffer = await generateReportPdf(tenantId, startDate, endDate);

    const filename = `prestacao-contas-${startDate}-${endDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[REPORT] Erro ao gerar PDF:', err);
    return res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

export default router;
```

- [ ] **Step 2: Verificar que o TypeScript compila sem erros**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros de tipo

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/reportRoutes.ts
git commit -m "feat: add reportRoutes POST /api/reports/generate"
```

---

## Task 5: Registrar rota em app.ts

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Adicionar import e registro da rota**

No arquivo `backend/src/app.ts`, adicione o import após os outros imports de rotas:

```typescript
import reportRoutes from './routes/reportRoutes';
```

E adicione o registro após a linha `app.use('/api/broadcasts', broadcastRoutes);`:

```typescript
app.use('/api/reports', reportRoutes);
```

- [ ] **Step 2: Verificar que o TypeScript compila**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros

- [ ] **Step 3: Rodar todos os testes do backend**

```bash
cd backend && npm test
```

Expected: PASS (nenhum teste quebrado)

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: register /api/reports route in app"
```

---

## Task 6: Criar ReportModal.tsx

**Files:**
- Create: `frontend/src/components/ReportModal.tsx`

- [ ] **Step 1: Criar o componente**

Crie `frontend/src/components/ReportModal.tsx`:

```tsx
import { useState } from 'react';
import { X, FileText, Loader2, Calendar } from 'lucide-react';
import api from '../api/client';

type ReportType = 'mensal' | 'trimestral' | 'anual' | 'custom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: ReportType; label: string; desc: string }[] = [
  { value: 'mensal', label: 'Mensal', desc: 'Mês atual' },
  { value: 'trimestral', label: 'Trimestral', desc: 'Últimos 3 meses' },
  { value: 'anual', label: 'Anual', desc: `Janeiro a hoje (${new Date().getFullYear()})` },
  { value: 'custom', label: 'Personalizado', desc: 'Escolha o período' },
];

export default function ReportModal({ isOpen, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedType(null);
    setCustomStart('');
    setCustomEnd('');
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    if (!selectedType) return;
    if (selectedType === 'custom' && (!customStart || !customEnd)) {
      setError('Informe o período inicial e final.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = { type: selectedType };
      if (selectedType === 'custom') {
        body.startDate = customStart;
        body.endDate = customEnd;
      }

      const res = await api.post('/reports/generate', body, {
        responseType: 'blob',
        timeout: 30000,
      });

      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `prestacao-contas-${selectedType}-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      handleClose();
    } catch {
      setError('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Gerar Relatório</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Prestação de Contas</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500 font-medium">Selecione o período do relatório:</p>

          <div className="grid grid-cols-2 gap-3">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedType(opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedType === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <p className={`font-black text-sm ${selectedType === opt.value ? 'text-blue-700' : 'text-slate-800'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {selectedType === 'custom' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <Calendar size={14} />
                Período personalizado
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Início</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fim</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selectedType || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Gerando relatório...
              </>
            ) : (
              <>
                <FileText size={16} />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ReportModal.tsx
git commit -m "feat: add ReportModal component with period selector and PDF download"
```

---

## Task 7: Criar Reports.tsx (página)

**Files:**
- Create: `frontend/src/pages/Dashboard/Reports.tsx`

- [ ] **Step 1: Criar a página**

Crie `frontend/src/pages/Dashboard/Reports.tsx`:

```tsx
import { useState } from 'react';
import { FileText, Download, CalendarDays, TrendingUp, BarChart3, FileCheck } from 'lucide-react';
import ReportModal from '../../components/ReportModal';

const FEATURES = [
  { icon: TrendingUp, label: 'KPIs do período', desc: 'Demandas totais, concluídas, munícipes atendidos' },
  { icon: BarChart3, label: 'Gráficos por bairro e categoria', desc: 'Visualização das demandas do território' },
  { icon: FileCheck, label: 'Indicações protocoladas', desc: 'Lista completa com números e status' },
  { icon: CalendarDays, label: 'Alcance de comunicação', desc: 'Mensagens enviadas via WhatsApp no período' },
];

export default function Reports() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            Prestação de Contas
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
            Relatório PDF profissional do mandato
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-colors shadow-sm shadow-blue-200"
        >
          <Download size={16} />
          Gerar Relatório
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <div className="max-w-2xl">
          <h2 className="text-lg font-black text-slate-800 mb-2">O que está incluído no relatório</h2>
          <p className="text-sm text-slate-500 mb-6">
            Gere um PDF completo com os dados do seu mandato para compartilhar com eleitores e redes sociais.
            Selecione o período (mensal, trimestral, anual ou personalizado) e baixe em segundos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(f => (
              <div key={f.label} className="flex gap-3 p-4 bg-slate-50 rounded-xl">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['mensal', 'trimestral', 'anual'] as const).map(type => {
          const labels: Record<string, { title: string; sub: string }> = {
            mensal: { title: 'Mensal', sub: 'Mês atual' },
            trimestral: { title: 'Trimestral', sub: 'Últimos 3 meses' },
            anual: { title: 'Anual', sub: `Janeiro–${new Date().getFullYear()}` },
          };
          return (
            <button
              key={type}
              onClick={() => setModalOpen(true)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <FileText size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors mb-3" />
              <p className="font-black text-slate-800">{labels[type].title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{labels[type].sub}</p>
            </button>
          );
        })}
      </div>

      <ReportModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard/Reports.tsx
git commit -m "feat: add Reports page with feature overview and quick-type shortcuts"
```

---

## Task 8: Registrar rota e menu no frontend

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Adicionar import e rota em App.tsx**

No arquivo `frontend/src/App.tsx`, adicione o import após os outros imports de páginas:

```typescript
import Reports from './pages/Dashboard/Reports';
```

Adicione a rota após `<Route path="broadcasts" element={<Broadcasts />} />`:

```tsx
<Route path="reports" element={<Reports />} />
```

- [ ] **Step 2: Adicionar item no Sidebar**

No arquivo `frontend/src/components/Sidebar.tsx`, adicione `FileText` aos imports do lucide-react:

```typescript
import {
  // ... imports existentes ...
  FileText,
} from 'lucide-react';
```

No array `menuItems`, adicione após o item de `Disparo em Massa`:

```typescript
{ name: 'Prestação de Contas', icon: FileText, path: '/dashboard/reports' },
```

- [ ] **Step 3: Verificar que o TypeScript do frontend compila**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros

- [ ] **Step 4: Commit final**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat: add Reports route and Sidebar entry — Fase 3 Prestação de Contas completa"
```

---

## Checklist de Verificação Pós-Implementação

Após todos os tasks, verifique manualmente:

- [ ] `npm test` no backend passa sem erros
- [ ] `npx tsc --noEmit` no backend sem erros
- [ ] `npx tsc --noEmit` no frontend sem erros
- [ ] "Prestação de Contas" aparece no menu lateral
- [ ] Modal abre ao clicar "Gerar Relatório"
- [ ] Seleção de tipo Mensal gera download do PDF
- [ ] PDF contém capa com dados do tenant
- [ ] PDF contém gráficos SVG de bairro e categoria
- [ ] PDF contém tabela de indicações
- [ ] Tipo "Personalizado" exibe date pickers
- [ ] Erro no backend retorna mensagem de erro no frontend (não trava a UI)
