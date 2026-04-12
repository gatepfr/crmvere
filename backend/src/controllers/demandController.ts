import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export const createDemand = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { municipeName, municipePhone, municipeBairro, categoria, prioridade, resumoIa, precisaRetorno } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Find or create citizen
      let [municipe] = await tx.select()
        .from(municipes)
        .where(and(eq(municipes.phone, municipePhone), eq(municipes.tenantId, tenantId)));

      if (!municipe) {
        const [newMunicipe] = await tx.insert(municipes)
          .values({
            tenantId,
            name: municipeName,
            phone: municipePhone,
            bairro: municipeBairro
          })
          .returning();
        municipe = newMunicipe;
      }

      // 2. Create demand
      const [newDemand] = await tx.insert(demandas)
        .values({
          tenantId,
          municipeId: municipe.id,
          categoria: categoria || 'outro',
          prioridade: prioridade || 'media',
          resumoIa: resumoIa,
          status: 'nova',
          precisaRetorno: precisaRetorno || false
        })
        .returning();

      return { demand: newDemand, municipe };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating manual demand:', error);
    res.status(500).json({ error: 'Failed to create demand' });
  }
};

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
  const { id } = req.params as { id: string };
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

export const updateDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status, resumoIa, prioridade, categoria, precisaRetorno } = req.body;
  const tenantId = req.user?.tenantId;

  try {
    const updateData: any = {};
    if (status) updateData.status = status;
    if (prioridade) updateData.prioridade = prioridade;
    if (categoria) updateData.categoria = categoria;
    if (precisaRetorno !== undefined) updateData.precisaRetorno = precisaRetorno;
    if (resumoIa !== undefined) updateData.resumoIa = resumoIa;

    await db.update(demandas)
      .set(updateData)
      .where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating demand:', error);
    res.status(500).json({ error: 'Failed to update demand' });
  }
};

export const updateMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, phone, bairro } = req.body;
  const tenantId = req.user?.tenantId;

  try {
    const [updated] = await db.update(municipes)
      .set({ name, phone, bairro })
      .where(and(eq(municipes.id, id), eq(municipes.tenantId, tenantId!)))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update citizen' });
  }
};

export const deleteMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;

  try {
    await db.delete(municipes).where(and(eq(municipes.id, id), eq(municipes.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete citizen' });
  }
};
