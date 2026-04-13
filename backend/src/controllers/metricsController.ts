import { Request, Response } from 'express';
import { db } from '../db';
import { demandas } from '../db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

export const getDashboardStats = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  console.log(`[METRICS] Fetching stats for tenant: ${tenantId}`);
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  try {
    // 1. Total demands
    console.log('[METRICS] Running summary query...');
    const [summary] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${demandas.status} = 'nova')::int`
    })
    .from(demandas)
    .where(eq(demandas.tenantId, tenantId));
    console.log('[METRICS] Summary result:', summary);

    // 2. Count by Category
    console.log('[METRICS] Running category query...');
    const categoryStats = await db.select({
      name: demandas.categoria,
      value: sql<number>`count(*)::int`
    })
    .from(demandas)
    .where(eq(demandas.tenantId, tenantId))
    .groupBy(demandas.categoria);
    console.log('[METRICS] Category result count:', categoryStats.length);

    // 3. Last 7 days
    console.log('[METRICS] Running daily stats query...');
    const last7Days = await db.select({
      date: sql<string>`TO_CHAR(${demandas.createdAt}, 'DD/MM')`,
      count: sql<number>`count(*)::int`,
      day: sql`DATE_TRUNC('day', ${demandas.createdAt})`
    })
    .from(demandas)
    .where(and(
      eq(demandas.tenantId, tenantId),
      sql`${demandas.createdAt} >= CURRENT_DATE - INTERVAL '7 days'`
    ))
    .groupBy(sql`DATE_TRUNC('day', ${demandas.createdAt}), TO_CHAR(${demandas.createdAt}, 'DD/MM')`)
    .orderBy(sql`DATE_TRUNC('day', ${demandas.createdAt}) ASC`);
    console.log('[METRICS] Daily stats result count:', last7Days.length);

    res.json({
      summary: { total: summary?.total || 0, pending: summary?.pending || 0 },
      categoryStats: categoryStats.map(c => ({ ...c, value: Number(c.value) })),
      dailyStats: last7Days.map(d => ({ date: d.date, count: Number(d.count) }))
    });
  } catch (error: any) {
    console.error('[METRICS] Error fetching dashboard stats:', error.message);
    console.error('[METRICS] Full error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch statistics', details: error.message });
  }
};
