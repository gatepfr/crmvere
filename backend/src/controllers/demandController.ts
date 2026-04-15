import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, systemConfigs, tenants } from '../db/schema';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

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

  console.log('--- Início da Importação CSV (Modo Robusto) ---');

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (!file) return res.status(400).json({ error: 'CSV file is required' });
  
  const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;

  try {
    // 1. Read file as buffer to handle encoding
    const fileBuffer = fs.readFileSync(file.path);
    
    // 2. Try to detect encoding or default to common ones
    let content = iconv.decode(fileBuffer, 'utf-8');
    if (content.includes('')) { // Detection of encoding error
      content = iconv.decode(fileBuffer, 'iso-8859-1');
    }

    // 3. Clean content (remove BOM, normalize line endings)
    content = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    // 4. Detect delimiter
    const firstLine = content.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    
    console.log(`Delimitador: "${delimiter}", Encoding: Detectado, Linhas: ${content.split('\n').length}`);

    // 5. Parse CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: delimiter,
      relax_column_count: true
    });

    const toInsert: any[] = [];
    let skipped = 0;

    for (const record of records) {
      const name = record[parsedMapping.name];
      let phone = record[parsedMapping.phone];
      const bairro = record[parsedMapping.bairro];
      let birthDate = null;

      if (name && phone) {
        // Clean phone
        phone = phone.toString().replace(/\D/g, '');
        if (!phone.startsWith('55') && phone.length >= 10) phone = '55' + phone;

        // Process Date
        if (parsedMapping.birthDate && record[parsedMapping.birthDate]) {
          try {
            const rawDate = record[parsedMapping.birthDate].toString();
            if (rawDate.includes('/')) {
              const [d, m, y] = rawDate.split('/');
              birthDate = new Date(`${y}-${m}-${d}T12:00:00Z`);
            } else {
              birthDate = new Date(rawDate);
            }
            if (isNaN(birthDate.getTime())) birthDate = null;
          } catch (e) { birthDate = null; }
        }

        toInsert.push({
          tenantId,
          name: name.toString().substring(0, 255),
          phone: phone.substring(0, 50),
          bairro: bairro ? bairro.toString().substring(0, 255) : null,
          birthDate
        });
      } else {
        skipped++;
      }
    }

    console.log(`Válidos: ${toInsert.length}, Pulados: ${skipped}`);

    // 6. Batch Insert (100 at a time)
    if (toInsert.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        await db.insert(municipes).values(chunk).onConflictDoNothing();
      }
    }

    // Cleanup
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    
    res.json({ success: true, imported: toInsert.length, skipped });
  } catch (error: any) {
    console.error('ERRO CRÍTICO NA IMPORTAÇÃO:', error);
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Erro no processamento do arquivo: ' + error.message });
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
