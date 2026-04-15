import { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, tenants } from '../db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

export const getDashboardStats = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    // 0. Tenant Info (Tokens)
    const [tenant] = await db.select({
      dailyTokenLimit: tenants.dailyTokenLimit,
      tokenUsageTotal: tenants.tokenUsageTotal
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

    // 1. Summary of Demands    const [summary] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${demandas.status} = 'nova')::int`,
      needsAttention: sql<number>`count(*) filter (where ${demandas.precisaRetorno} = true)::int`
    })
    .from(demandas)
    .where(eq(demandas.tenantId, tenantId));

    // 2. Summary of Municipes
    const [municipeSummary] = await db.select({
      total: sql<number>`count(*)::int`,
      birthdaysToday: sql<number>`count(*) filter (where 
        to_char(${municipes.birthDate}, 'DD-MM') = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD-MM')
      )::int`,
      uniqueBairros: sql<number>`count(distinct ${municipes.bairro})::int`
    })
    .from(municipes)
    .where(eq(municipes.tenantId, tenantId));

    // 3. Count by Category
    const categoryStats = await db.select({
      name: demandas.categoria,
      value: sql<number>`count(*)::int`
    })
    .from(demandas)
    .where(eq(demandas.tenantId, tenantId))
    .groupBy(demandas.categoria);

    // 4. Last 7 days
    const last7Days = await db.select({
      date: sql<string>`TO_CHAR(${demandas.createdAt} AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')`,
      count: sql<number>`count(*)::int`,
      day: sql`DATE_TRUNC('day', ${demandas.createdAt})`
    })
    .from(demandas)
    .where(and(
      eq(demandas.tenantId, tenantId),
      sql`${demandas.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`
    ))
    .groupBy(sql`DATE_TRUNC('day', ${demandas.createdAt}), TO_CHAR(${demandas.createdAt} AT TIME ZONE 'America/Sao_Paulo', 'DD/MM')`)
    .orderBy(sql`DATE_TRUNC('day', ${demandas.createdAt}) ASC`);

    res.json({
      summary: { 
        total: summary?.total || 0, 
        pending: summary?.pending || 0,
        needsAttention: summary?.needsAttention || 0,
        municipesTotal: municipeSummary?.total || 0,
        birthdaysToday: municipeSummary?.birthdaysToday || 0,
        uniqueBairros: municipeSummary?.uniqueBairros || 0,
        dailyTokenLimit: tenant?.dailyTokenLimit || 0,
        tokenUsageTotal: tenant?.tokenUsageTotal || 0
      },
      categoryStats: categoryStats.map(c => ({ ...c, value: Number(c.value) })),
      dailyStats: last7Days.map(d => ({ date: d.date, count: Number(d.count) }))
    });
  } catch (error: any) {
    console.error('[METRICS] Error fetching dashboard stats:', error.message);
    console.error('[METRICS] Full error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch statistics', details: error.message });
  }
};
