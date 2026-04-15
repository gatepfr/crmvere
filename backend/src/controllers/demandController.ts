import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes } from '../db/schema';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import fs from 'fs';
import { parse } from 'csv-parse';

export const createMunicipe = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, phone, bairro, birthDate } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

  try {
    const [newMunicipe] = await db.insert(municipes)
      .values({
        tenantId,
        name,
        phone: phone.replace(/\D/g, ''),
        bairro,
        birthDate: birthDate ? new Date(birthDate) : null
      })
      .returning();

    res.status(201).json(newMunicipe);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Este número de telefone já está cadastrado.' });
    }
    console.error('Error creating manual municipe:', error);
    res.status(500).json({ error: 'Failed to create municipe' });
  }
};

export const importMunicipes = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const file = req.file;
  const { mapping } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (!file) return res.status(400).json({ error: 'CSV file is required' });
  
  const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;

  const records: any[] = [];
  const parser = fs.createReadStream(file.path).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true
  }));

  try {
    for await (const record of parser) {
      const name = record[parsedMapping.name];
      const phone = record[parsedMapping.phone]?.replace(/\D/g, '');
      const bairro = record[parsedMapping.bairro];
      const rawBirthDate = parsedMapping.birthDate ? record[parsedMapping.birthDate] : null;

      if (name && phone) {
        records.push({
          tenantId,
          name,
          phone,
          bairro,
          birthDate: rawBirthDate ? new Date(rawBirthDate) : null
        });
      }
    }

    if (records.length > 0) {
      await db.insert(municipes).values(records).onConflictDoNothing();
    }

    fs.unlinkSync(file.path);
    res.json({ success: true, imported: records.length });
  } catch (error) {
    console.error('Error importing municipes:', error);
    if (file) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
};

export const createDemand = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { municipeName, municipePhone, municipeBairro, categoria, prioridade, resumoIa, precisaRetorno } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const result = await db.transaction(async (tx) => {
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
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [totalCount] = await db.select({ count: count() })
      .from(demandas)
      .where(eq(demandas.tenantId, tenantId));

    const results = await db
      .select({
        demandas: demandas,
        municipes: municipes
      })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(eq(demandas.tenantId, tenantId))
      .orderBy(desc(demandas.updatedAt))
      .limit(limit)
      .offset(offset);

    res.status(200).json({
      data: results,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / limit)
      }
    });
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

    if (!demand) return res.status(404).json({ error: 'Demand not found' });
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
    if (status) {
      updateData.status = status;
      if (status === 'concluida') updateData.precisaRetorno = false;
    }
    if (prioridade) updateData.prioridade = prioridade;
    if (categoria) updateData.categoria = categoria;
    if (precisaRetorno !== undefined) updateData.precisaRetorno = precisaRetorno;
    if (resumoIa !== undefined) updateData.resumoIa = resumoIa;
    updateData.updatedAt = new Date();

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
  const { name, phone, bairro, birthDate } = req.body;
  const tenantId = req.user?.tenantId;

  try {
    const [updated] = await db.update(municipes)
      .set({ 
        name, 
        phone: phone.replace(/\D/g, ''), 
        bairro, 
        birthDate: birthDate ? new Date(birthDate) : null 
      })
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

export const listMunicipes = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [totalCount] = await db.select({ count: count() })
      .from(municipes)
      .where(eq(municipes.tenantId, tenantId));

    const results = await db.select({
      id: municipes.id,
      name: municipes.name,
      phone: municipes.phone,
      bairro: municipes.bairro,
      birthDate: municipes.birthDate,
      createdAt: municipes.createdAt,
      demandCount: sql<number>`count(${demandas.id})::int`
    })
    .from(municipes)
    .leftJoin(demandas, eq(municipes.id, demandas.municipeId))
    .where(eq(municipes.tenantId, tenantId))
    .groupBy(municipes.id)
    .orderBy(desc(municipes.createdAt))
    .limit(limit)
    .offset(offset);

    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error listing citizens with counts:', error);
    res.status(500).json({ error: 'Failed to list citizens' });
  }
};
