// These imports are used by collectReportData and generateReportPdf (added in Task 3)
import puppeteer from 'puppeteer-core';
import { db } from '../db';
import { tenants, demandas, municipes, broadcasts } from '../db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface BarItem {
  label: string;
  value: number;
}

const escapeSvg = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
        <text x="135" y="${y + 13}" text-anchor="end" font-size="11" fill="#475569" font-family="Arial">${escapeSvg(item.label)}</text>
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
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { startDate: fmt(start), endDate: fmt(now) };
  }

  if (type === 'anual') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: fmt(now) };
  }

  // custom
  if (!customStart || !customEnd) {
    throw new Error('calcDateRange: customStart and customEnd are required for type "custom"');
  }
  return { startDate: customStart, endDate: customEnd };
}

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

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate + 'T23:59:59.999');

  const [
    statusCounts,
    bairroRows,
    categoriaRows,
    indicacoesRows,
    [municipeSummary],
    broadcastRows,
  ] = await Promise.all([
    db.select({ status: demandas.status, count: sql<number>`count(*)::int` })
      .from(demandas)
      .where(and(eq(demandas.tenantId, tenantId), gte(demandas.createdAt, start), lte(demandas.createdAt, end)))
      .groupBy(demandas.status),

    db.select({ bairro: municipes.bairro, count: sql<number>`count(*)::int` })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(and(eq(demandas.tenantId, tenantId), gte(demandas.createdAt, start), lte(demandas.createdAt, end)))
      .groupBy(municipes.bairro)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    db.select({ categoria: demandas.categoria, count: sql<number>`count(*)::int` })
      .from(demandas)
      .where(and(eq(demandas.tenantId, tenantId), gte(demandas.createdAt, start), lte(demandas.createdAt, end)))
      .groupBy(demandas.categoria)
      .orderBy(sql`count(*) desc`)
      .limit(15),

    db.select({ numeroIndicacao: demandas.numeroIndicacao, descricao: demandas.descricao, status: demandas.status, createdAt: demandas.createdAt })
      .from(demandas)
      .where(and(eq(demandas.tenantId, tenantId), eq(demandas.isLegislativo, true), gte(demandas.createdAt, start), lte(demandas.createdAt, end)))
      .orderBy(demandas.createdAt)
      .limit(50),

    db.select({ total: sql<number>`count(*)::int` })
      .from(municipes)
      .where(eq(municipes.tenantId, tenantId)),

    db.select({ totalSent: sql<number>`coalesce(sum(${broadcasts.sentCount}), 0)::int` })
      .from(broadcasts)
      .where(and(eq(broadcasts.tenantId, tenantId), eq(broadcasts.status, 'concluido'), gte(broadcasts.completedAt, start), lte(broadcasts.completedAt, end))),
  ]);

  const countMap: Record<string, number> = {};
  statusCounts.forEach(r => { countMap[r.status] = Number(r.count); });
  const totalDemandas = Object.values(countMap).reduce((a, b) => a + b, 0);

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
      .map(r => ({ label: r.categoria.toUpperCase(), value: Number(r.count) })),
    indicacoes: indicacoesRows,
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPeriod(startDate: string, endDate: string): string {
  return `${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} a ${new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildHtmlTemplate(data: ReportData): string {
  const { tenant, period } = data;

  const isSafeUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');
  const fotoHtml = tenant.fotoUrl && isSafeUrl(tenant.fotoUrl)
    ? `<img src="${tenant.fotoUrl}" style="width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.4);box-shadow:0 8px 32px rgba(0,0,0,0.25)" />`
    : `<div style="width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:44px">👤</div>`;

  const statusBar = () => {
    const total = data.totalDemandas || 1;
    const items = [
      { label: 'Novas', value: data.demandasNova, color: '#3b82f6' },
      { label: 'Em andamento', value: data.demandasEmAndamento, color: '#f59e0b' },
      { label: 'Concluídas', value: data.demandasConcluidas, color: '#10b981' },
      { label: 'Canceladas', value: data.demandasCanceladas, color: '#ef4444' },
    ].filter(i => i.value > 0);

    const bars = items.map(i => {
      const pct = Math.round((i.value / total) * 100);
      return `<div style="flex:${pct};background:${i.color};min-width:4px" title="${i.label}"></div>`;
    }).join('');

    const legend = items.map(i => `
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:2px;background:${i.color};flex-shrink:0"></div>
        <span style="font-size:11px;color:#64748b;font-weight:600">${i.label}</span>
        <span style="font-size:11px;color:#1e293b;font-weight:800">${i.value}</span>
      </div>`).join('');

    return `
      <div style="background:#f8fafc;border-radius:12px;padding:20px 24px">
        <div style="display:flex;height:10px;border-radius:8px;overflow:hidden;gap:2px;margin-bottom:16px">${bars}</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">${legend}</div>
      </div>`;
  };

  const section = (title: string, content: string, icon = '') => `
    <div style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        ${icon ? `<div style="width:32px;height:32px;border-radius:8px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:16px">${icon}</div>` : ''}
        <h2 style="font-size:13px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:2px">${title}</h2>
        <div style="flex:1;height:1px;background:#e2e8f0;margin-left:8px"></div>
      </div>
      ${content}
    </div>`;

  const indicacoesRows = data.indicacoes.length === 0
    ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8;font-style:italic;padding:20px;font-size:12px">Nenhuma indicação protocolada no período</td></tr>`
    : data.indicacoes.map((ind, i) => `
        <tr style="background:${i % 2 === 0 ? 'white' : '#f8fafc'}">
          <td style="padding:10px 14px;font-size:12px;font-weight:800;color:#3b82f6;white-space:nowrap">${ind.numeroIndicacao ? `Nº ${ind.numeroIndicacao}` : '—'}</td>
          <td style="padding:10px 14px;font-size:12px;color:#334155;line-height:1.4">${escapeHtml(ind.descricao.length > 90 ? ind.descricao.slice(0, 90) + '…' : ind.descricao)}</td>
          <td style="padding:10px 14px;font-size:11px;color:#94a3b8;white-space:nowrap;text-align:right">${formatDate(ind.createdAt)}</td>
        </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; background: white; font-size: 13px; }
    @page { margin: 0; size: A4; }
  </style>
</head>
<body>

<!-- CAPA -->
<div style="page-break-after:always;min-height:297mm;display:flex;flex-direction:column">

  <!-- Header azul -->
  <div style="background:linear-gradient(150deg,#0f2952 0%,#1d4ed8 60%,#3b82f6 100%);padding:64px 56px 56px;flex:1;display:flex;flex-direction:column;justify-content:space-between">

    <div>
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:rgba(255,255,255,0.5);margin-bottom:40px">Prestação de Contas do Mandato</p>
      <div style="display:flex;align-items:center;gap:32px;margin-bottom:48px">
        ${fotoHtml}
        <div style="color:white">
          <h1 style="font-size:32px;font-weight:900;line-height:1.15;margin-bottom:10px">${escapeHtml(tenant.name)}</h1>
          <p style="font-size:14px;opacity:0.75;font-weight:600;margin-bottom:4px">${escapeHtml(tenant.partido ?? '')}${tenant.municipio ? ' • ' + escapeHtml(tenant.municipio) : ''}${tenant.uf ? '/' + escapeHtml(tenant.uf) : ''}</p>
          ${tenant.mandato ? `<p style="font-size:12px;opacity:0.55;font-weight:500">${escapeHtml(tenant.mandato)}</p>` : ''}
        </div>
      </div>
    </div>

    <!-- KPIs na capa -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
      ${[
        { label: 'Total de Demandas', value: data.totalDemandas, icon: '📋' },
        { label: 'Indicações Protocoladas', value: data.indicacoes.length, icon: '📜' },
      ].map(k => `
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:20px 24px;backdrop-filter:blur(4px)">
          <p style="font-size:24px;margin-bottom:4px">${k.icon}</p>
          <p style="font-size:30px;font-weight:900;color:white;line-height:1">${k.value}</p>
          <p style="font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-top:6px">${k.label}</p>
        </div>`).join('')}
    </div>
  </div>

  <!-- Faixa do período -->
  <div style="background:#f8fafc;border-top:3px solid #1d4ed8;padding:18px 56px;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8">Período de referência</span>
    <span style="font-size:13px;font-weight:800;color:#1e293b">${formatPeriod(period.startDate, period.endDate)}</span>
  </div>
</div>

<!-- CONTEÚDO -->
<div style="padding:40px 48px">

  <!-- STATUS DAS DEMANDAS -->
  ${section('Situação das Demandas', statusBar(), '📊')}

  <!-- DEMANDAS POR BAIRRO -->
  ${section('Demandas por Bairro · Top 10', buildSvgBars(data.demandsByBairro), '📍')}

  <!-- DEMANDAS POR CATEGORIA -->
  ${section('Demandas por Categoria', buildSvgBars(data.demandsByCategoria), '🏷️')}

  <!-- INDICAÇÕES PROTOCOLADAS -->
  ${section('Indicações Protocoladas', `
    <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <thead>
        <tr style="background:#1d4ed8">
          <th style="text-align:left;padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.85);font-weight:700;white-space:nowrap">Nº</th>
          <th style="text-align:left;padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.85);font-weight:700">Descrição</th>
          <th style="text-align:right;padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.85);font-weight:700;white-space:nowrap">Data</th>
        </tr>
      </thead>
      <tbody>${indicacoesRows}</tbody>
    </table>`, '📜')}

</div>

<!-- RODAPÉ -->
<div style="padding:16px 48px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">
  <span style="font-size:10px;color:#cbd5e1;font-weight:600;text-transform:uppercase;letter-spacing:1px">VereDoc</span>
  <span style="font-size:10px;color:#cbd5e1">Gerado em ${formatDate(new Date())}</span>
</div>

</body>
</html>`;
}

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
