import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const listDemands = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    res.status(403).json({ error: 'No tenant context' });
    return;
  }

  try {
    const results = await db
      .select({
        demandas: demandas,
        municipes: municipes
      })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(eq(demandas.tenantId, tenantId))
      .orderBy(desc(demandas.createdAt));

    res.status(200).json(results);
  } catch (error) {
    console.error('Error listing demands:', error);
    res.status(500).json({ error: 'Failed to list demands' });
  }
};

export const getDemand = async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenantId;

  try {
    const [demand] = await db
      .select({
        demandas: demandas,
        municipes: municipes
      })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));

    if (!demand) {
      res.status(404).json({ error: 'Demand not found' });
      return;
    }

    res.status(200).json(demand);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get demand' });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const tenantId = req.user?.tenantId;

  try {
    await db
      .update(demandas)
      .set({ status })
      .where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};
