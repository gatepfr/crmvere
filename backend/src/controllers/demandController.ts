import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, systemConfigs, tenants, demandCategories } from '../db/schema';
import { eq, desc, and, sql, count, ilike, or } from 'drizzle-orm';
import { normalizePhone } from '../utils/phoneUtils';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

export const createMunicipe = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, phone, cep, bairro, birthDate } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

  try {
    const [newMunicipe] = await db.insert(municipes)
      .values({
        tenantId,
        name,
        phone: normalizePhone(phone),
        cep,
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

  try {
    const fileBuffer = fs.readFileSync(file.path);
    let content = iconv.decode(fileBuffer, 'utf-8');
    if (content.includes('')) {
      content = iconv.decode(fileBuffer, 'iso-8859-1');
    }
    content = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    const firstLine = content.split('\n')[0];
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: delimiter,
      relax_column_count: true
    });

    const toInsert: any[] = [];
    for (const record of records) {
      const name = record[parsedMapping.name];
      let phone = record[parsedMapping.phone];
      if (name && phone) {
        phone = normalizePhone(phone.toString());
        
        let birthDate = null;
        if (parsedMapping.birthDate && record[parsedMapping.birthDate]) {
          try {
            const rawDate = record[parsedMapping.birthDate].toString();
            if (rawDate.includes('/')) {
              const [d, m, y] = rawDate.split('/');
              birthDate = new Date(`${y}-${m}-${d}T12:00:00Z`);
            } else {
              birthDate = new Date(rawDate);
            }
          } catch (e) {}
        }

        toInsert.push({
          tenantId,
          name: name.toString().substring(0, 255),
          phone: phone.substring(0, 50),
          bairro: record[parsedMapping.bairro]?.toString().substring(0, 255) || null,
          birthDate: birthDate && !isNaN(birthDate.getTime()) ? birthDate : null
        });
      }
    }

    if (toInsert.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        await db.insert(municipes).values(toInsert.slice(i, i + chunkSize)).onConflictDoNothing();
      }
    }

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.json({ success: true, imported: toInsert.length });
  } catch (error: any) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: error.message });
  }
};

export const createDemand = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { municipeName, municipePhone, municipeCep, municipeBairro, categoria, prioridade, resumoIa, precisaRetorno } = req.body;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const normalizedPhone = normalizePhone(municipePhone);

  try {
    const result = await db.transaction(async (tx) => {
      let [municipe] = await tx.select()
        .from(municipes)
        .where(and(eq(municipes.phone, normalizedPhone), eq(municipes.tenantId, tenantId)));

      if (!municipe) {
        const [newMunicipe] = await tx.insert(municipes)
          .values({
            tenantId,
            name: municipeName,
            phone: normalizedPhone,
            cep: municipeCep,
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
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const status = req.query.status as string;
  const priority = req.query.priority as string;
  const attention = req.query.attention === 'true';
  const offset = (page - 1) * limit;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    // Build filter conditions
    const conditions = [eq(demandas.tenantId, tenantId)];
    if (category) conditions.push(eq(demandas.categoria, category));
    if (status) conditions.push(eq(demandas.status, status as any));
    if (priority) conditions.push(eq(demandas.prioridade, priority));
    if (attention) conditions.push(eq(demandas.precisaRetorno, true));
    
    if (search) {
      conditions.push(or(
        ilike(municipes.name, `%${search}%`),
        ilike(municipes.phone, `%${search}%`)
      ) as any);
    }

    const whereClause = and(...conditions);

    const [totalCount] = await db.select({ count: count() })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(whereClause);

    const results = await db
      .select({
        demandas: demandas,
        municipes: municipes
      })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(whereClause)
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
  const { status, resumoIa, prioridade, categoria, precisaRetorno, isLegislativo, numeroIndicacao, documentUrl } = req.body;
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
    
    // Novos campos legislativos
    if (isLegislativo !== undefined) updateData.isLegislativo = isLegislativo;
    if (numeroIndicacao !== undefined) updateData.numeroIndicacao = numeroIndicacao;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;

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

// CATEGORIES CONTROLLERS
export const listCategories = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const categories = await db.select().from(demandCategories).where(eq(demandCategories.tenantId, tenantId));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list categories' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, color, icon } = req.body;

  if (req.user?.role !== 'admin' && req.user?.role !== 'vereador') {
    return res.status(403).json({ error: 'Apenas administradores podem criar categorias.' });
  }

  try {
    const [newCategory] = await db.insert(demandCategories)
      .values({ tenantId: tenantId!, name, color, icon })
      .returning();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;

  if (req.user?.role !== 'admin' && req.user?.role !== 'vereador') {
    return res.status(403).json({ error: 'Permissão negada.' });
  }

  try {
    await db.delete(demandCategories).where(and(eq(demandCategories.id, id), eq(demandCategories.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

export const updateMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, phone, cep, bairro, birthDate } = req.body;
  const tenantId = req.user?.tenantId;

  try {
    const [updated] = await db.update(municipes)
      .set({ 
        name, 
        phone: normalizePhone(phone), 
        cep,
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
  const limitQuery = req.query.limit as string;
  const limit = limitQuery === 'all' ? 10000 : (parseInt(limitQuery) || 25);
  const search = req.query.search as string;
  const bairro = req.query.bairro as string;
  const engaged = req.query.engaged === 'true';
  const birthday = req.query.birthday === 'true';
  const sortBy = (req.query.sortBy as string) || 'name';
  const sortOrder = (req.query.sortOrder as string) === 'desc' ? desc : sql`asc`;
  const offset = limitQuery === 'all' ? 0 : (page - 1) * limit;

  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const conditions = [eq(municipes.tenantId, tenantId)];
    if (bairro) conditions.push(eq(municipes.bairro, bairro));
    if (search) {
      conditions.push(or(
        ilike(municipes.name, `%${search}%`),
        ilike(municipes.phone, `%${search}%`)
      ) as any);
    }
    if (birthday) {
      conditions.push(sql`to_char(${municipes.birthDate}, 'DD-MM') = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD-MM')`);
    }

    const whereClause = and(...conditions);

    const [totalCount] = await db.select({ count: count() })
      .from(municipes)
      .where(whereClause);

    // Map sortBy field to schema column
    let orderByField: any = municipes.name;
    if (sortBy === 'phone') orderByField = municipes.phone;
    if (sortBy === 'bairro') orderByField = municipes.bairro;
    if (sortBy === 'createdAt') orderByField = municipes.createdAt;
    if (sortBy === 'demandCount') orderByField = sql`count(${demandas.id})`;

    let query = db.select({
      id: municipes.id,
      name: municipes.name,
      phone: municipes.phone,
      cep: municipes.cep,
      bairro: municipes.bairro,
      birthDate: municipes.birthDate,
      createdAt: municipes.createdAt,
      demandCount: sql<number>`count(${demandas.id})::int`
    })
    .from(municipes)
    .leftJoin(demandas, eq(municipes.id, demandas.municipeId))
    .where(whereClause)
    .groupBy(municipes.id)
    .orderBy(sortOrder === desc ? desc(orderByField) : orderByField);

    if (engaged) {
      query = query.having(sql`count(${demandas.id}) >= 5`) as any;
    }

    const results = await query.limit(limit).offset(offset);

    res.json({
      data: results,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / (limit || 1))
      }
    });
  } catch (error) {
    console.error('Error listing citizens with counts:', error);
    res.status(500).json({ error: 'Failed to list citizens' });
  }
};
