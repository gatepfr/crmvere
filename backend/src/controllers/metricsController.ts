import { Request, Response } from 'express';
import { db } from '../db';
import { municipes, tenants, atendimentos } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { redisService } from '../services/redisService';

export const getDashboardStats = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [tenant] = await db.select({
      dailyTokenLimit: tenants.dailyTokenLimit,
    }).from(tenants).where(eq(tenants.id, tenantId));

    const today = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
    const tokenUsageToday = await redisService.getUsage(tenantId, today);

    const [summary] = await db.select({
      total: sql<number>`count(*)::int`,
      needsAttention: sql<number>`count(*) filter (where ${atendimentos.precisaRetorno} = true)::int`
    }).from(atendimentos).where(eq(atendimentos.tenantId, tenantId));

    const [municipeSummary] = await db.select({
      total: sql<number>`count(*)::int`,
      birthdaysToday: sql<number>`count(*) filter (where to_char(${municipes.birthDate}, 'DD-MM') = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD-MM'))::int`,
      uniqueBairros: sql<number>`count(distinct ${municipes.bairro})::int`
    }).from(municipes).where(eq(municipes.tenantId, tenantId));

    const categoryStats = await db.select({
      name: atendimentos.categoria,
      value: sql<number>`count(*)::int`
    }).from(atendimentos).where(eq(atendimentos.tenantId, tenantId)).groupBy(atendimentos.categoria);

    const last7Days = await db.select({
      date: sql<string>`TO_CHAR(${atendimentos.createdAt} AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')`,
      count: sql<number>`count(*)::int`,
      day: sql`DATE_TRUNC('day', ${atendimentos.createdAt} AT TIME ZONE 'America/Sao_Paulo')`
    }).from(atendimentos).where(and(eq(atendimentos.tenantId, tenantId), sql`(${atendimentos.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '7 days'`)).groupBy(sql`DATE_TRUNC('day', ${atendimentos.createdAt} AT TIME ZONE 'America/Sao_Paulo'), TO_CHAR(${atendimentos.createdAt} AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')`).orderBy(sql`DATE_TRUNC('day', ${atendimentos.createdAt} AT TIME ZONE 'America/Sao_Paulo') ASC`);

    res.json({
      summary: {
        total: summary?.total || 0,
        needsAttention: summary?.needsAttention || 0,
        municipesTotal: municipeSummary?.total || 0,
        birthdaysToday: municipeSummary?.birthdaysToday || 0,
        uniqueBairros: municipeSummary?.uniqueBairros || 0,
        dailyTokenLimit: tenant?.dailyTokenLimit || 0,
        tokenUsageTotal: tokenUsageToday
      },
      categoryStats: categoryStats.map(c => ({ ...c, value: Number(c.value) })),
      dailyStats: last7Days.map(d => ({ date: d.date, count: Number(d.count) }))
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed' });
  }
};
