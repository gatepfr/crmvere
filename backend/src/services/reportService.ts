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
