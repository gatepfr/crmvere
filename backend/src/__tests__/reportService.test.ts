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
