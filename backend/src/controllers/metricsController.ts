import { Request, Response } from 'express';
import { db } from '../db';
import { demandas } from '../db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

export const getDashboardStats = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  try {
    // 1. Total demands and pending count (Consolidated)
    const [summary] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${demandas.status} = 'nova')::int`
    })
    .from(demandas)
    .where(eq(demandas.tenantId, tenantId));

    // 2. Count by Category (for Pie Chart)
    const categoryStats = await db.select({
      name: demandas.categoria,
      value: sql<number>`count(*)::int`
    })
    .from(demandas)
    .where(eq(demandas.tenantId, tenantId))
    .groupBy(demandas.categoria);

    // 3. Demands over last 7 days (for Line Chart)
    const last7Days = await db.select({
      date: sql<string>`TO_CHAR(${demandas.createdAt}, 'DD/MM')`,
      count: sql<number>`count(*)::int`,
      day: sql<string>`DATE_TRUNC('day', ${demandas.createdAt})`
    })
    .from(demandas)
    .where(and(
      eq(demandas.tenantId, tenantId),
      sql`${demandas.createdAt} >= CURRENT_DATE - INTERVAL '6 days'`
    ))
    .groupBy(sql`DATE_TRUNC('day', ${demandas.createdAt}), TO_CHAR(${demandas.createdAt}, 'DD/MM')`)
    .orderBy(desc(sql`DATE_TRUNC('day', ${demandas.createdAt})`))
    .limit(7);

    res.json({
      summary: { total: summary?.total || 0, pending: summary?.pending || 0 },
      categoryStats: categoryStats.map(c => ({ ...c, value: Number(c.value) })),
      dailyStats: last7Days.reverse().map(d => ({ date: d.date, count: Number(d.count) }))
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
