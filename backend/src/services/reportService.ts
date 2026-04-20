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
