import { Request, Response } from 'express';
import { db } from '../db';
import { demandas } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export const getMetrics = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(403).json({ error: 'No tenant context' });
      return;
    }

    // Total demands
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId));
    
    const total = Number(totalResult[0]?.count || 0);

    // By Status
    const byStatusResult = await db
      .select({ 
        status: demandas.status, 
        count: sql<number>`count(*)` 
      })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId))
      .groupBy(demandas.status);

    // By Category
    const byCategoryResult = await db
      .select({ 
        categoria: demandas.categoria, 
        count: sql<number>`count(*)` 
      })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId))
      .groupBy(demandas.categoria);

    res.json({
      total,
      byStatus: byStatusResult,
      byCategory: byCategoryResult,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
