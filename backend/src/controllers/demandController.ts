import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, systemConfigs, tenants, demandCategories, atendimentos } from '../db/schema';
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
    if (content.includes('')) content = iconv.decode(fileBuffer, 'iso-8859-1');
    content = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const firstLine = content.split('\n')[0];
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true, delimiter: delimiter, relax_column_count: true });
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
            } else { birthDate = new Date(rawDate); }
          } catch (e) {}
        }
        toInsert.push({ tenantId, name: name.toString().substring(0, 255), phone: phone.substring(0, 50), bairro: record[parsedMapping.bairro]?.toString().substring(0, 255) || null, birthDate: birthDate && !isNaN(birthDate.getTime()) ? birthDate : null });
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
  const { municipeId, municipeName, municipePhone, municipeBairro, categoria, prioridade, resumoIa, atendimentoId } = req.body;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const result = await db.transaction(async (tx) => {
      let finalMunicipeId = municipeId;
      if (!finalMunicipeId) {
        const normalized = normalizePhone(municipePhone);
        let [existing] = await tx.select().from(municipes).where(and(eq(municipes.phone, normalized), eq(municipes.tenantId, tenantId)));
        if (!existing) {
          const [created] = await tx.insert(municipes).values({ tenantId, name: municipeName, phone: normalized, bairro: municipeBairro }).returning();
          finalMunicipeId = created.id;
        } else {
          finalMunicipeId = existing.id;
        }
      }
      const [newDemand] = await tx.insert(demandas).values({
        tenantId,
        municipeId: finalMunicipeId,
        atendimentoId: atendimentoId || null,
        categoria: categoria || 'outro',
        prioridade: prioridade || 'media',
        descricao: resumoIa,
        status: 'nova'
      }).returning();
      return newDemand;
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create demand' });
  }
};

export const listAtendimentos = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const attention = req.query.attention === 'true';
  const offset = (page - 1) * limit;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const conditions = [eq(atendimentos.tenantId, tenantId)];
    if (attention) conditions.push(eq(atendimentos.precisaRetorno, true));
    if (search) {
      conditions.push(or(ilike(municipes.name, `%${search}%`), ilike(municipes.phone, `%${search}%`)) as any);
    }
    const [totalCount] = await db.select({ count: count() }).from(atendimentos).innerJoin(municipes, eq(atendimentos.municipeId, municipes.id)).where(and(...conditions));
    const results = await db.select({ atendimentos: atendimentos, municipes: municipes }).from(atendimentos).innerJoin(municipes, eq(atendimentos.municipeId, municipes.id)).where(and(...conditions)).orderBy(desc(atendimentos.updatedAt)).limit(limit).offset(offset);
    res.json({ data: results, pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const listDemands = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const status = req.query.status as string;
  const offset = (page - 1) * limit;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const conditions = [eq(demandas.tenantId, tenantId)];
    if (category) conditions.push(eq(demandas.categoria, category));
    if (status) conditions.push(eq(demandas.status, status as any));
    if (search) {
      conditions.push(or(ilike(municipes.name, `%${search}%`), ilike(municipes.phone, `%${search}%`)) as any);
    }
    const [totalCount] = await db.select({ count: count() }).from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id)).where(and(...conditions));
    const results = await db.select({ demandas: demandas, municipes: municipes }).from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id)).where(and(...conditions)).orderBy(desc(demandas.createdAt)).limit(limit).offset(offset);
    res.json({ data: results, pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const getDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  try {
    const [demand] = await db.select({ demandas: demandas, municipes: municipes }).from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id)).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
    if (!demand) return res.status(404).json({ error: 'Demand not found' });
    res.status(200).json(demand);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const updateDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status, resumoIa, prioridade, categoria, precisaRetorno, isLegislativo, numeroIndicacao, documentUrl } = req.body;
  const tenantId = req.user?.tenantId;
  try {
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (prioridade) updateData.prioridade = prioridade;
    if (categoria) updateData.categoria = categoria;
    if (resumoIa) updateData.descricao = resumoIa;
    if (isLegislativo !== undefined) updateData.isLegislativo = isLegislativo;
    if (numeroIndicacao !== undefined) updateData.numeroIndicacao = numeroIndicacao;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    await db.update(demandas).set(updateData).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const updateAtendimento = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { precisaRetorno, status, categoria, prioridade } = req.body;
  const tenantId = req.user?.tenantId;
  
  try {
    const updateData: any = { updatedAt: new Date() };
    if (precisaRetorno !== undefined) updateData.precisaRetorno = precisaRetorno;
    if (categoria) updateData.categoria = categoria;
    if (prioridade) updateData.prioridade = prioridade;
    // Note: 'status' isn't on atendimentos table usually, but we can treat 'concluida' as unsetting 'precisaRetorno'
    if (status === 'concluida') updateData.precisaRetorno = false;

    await db.update(atendimentos)
      .set(updateData)
      .where(and(
        eq(atendimentos.id, id), 
        eq(atendimentos.tenantId, tenantId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('[UPDATE ATENDIMENTO ERROR]', error);
    res.status(500).json({ error: 'Failed' });
  }
};

export const listCategories = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    let cats = await db.select().from(demandCategories).where(eq(demandCategories.tenantId, tenantId));
    
    // Se não houver categorias, cria as padrões automaticamente
    if (cats.length === 0) {
      const defs = [
        { name: 'SAÚDE', color: '#db2777', icon: 'Activity' },
        { name: 'INFRAESTRUTURA', color: '#2563eb', icon: 'Hammer' },
        { name: 'SEGURANÇA', color: '#dc2626', icon: 'Shield' },
        { name: 'EDUCAÇÃO', color: '#7c3aed', icon: 'GraduationCap' },
        { name: 'FUNC. PÚBLICO', color: '#ea580c', icon: 'Briefcase' },
        { name: 'OUTRO', color: '#4b5563', icon: 'Tag' }
      ];
      for (const c of defs) {
        await db.insert(demandCategories).values({ ...c, tenantId }).onConflictDoNothing();
      }
      cats = await db.select().from(demandCategories).where(eq(demandCategories.tenantId, tenantId));
    }
    
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, color, icon } = req.body;
  try {
    const [nc] = await db.insert(demandCategories).values({ tenantId: tenantId!, name, color, icon }).returning();
    res.status(201).json(nc);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  try {
    await db.delete(demandCategories).where(and(eq(demandCategories.id, id), eq(demandCategories.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const seedCategories = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const defs = [
    { name: 'SAÚDE', color: '#db2777', icon: 'Activity' },
    { name: 'INFRAESTRUTURA', color: '#2563eb', icon: 'Hammer' },
    { name: 'SEGURANÇA', color: '#dc2626', icon: 'Shield' },
    { name: 'EDUCAÇÃO', color: '#7c3aed', icon: 'GraduationCap' },
    { name: 'FUNC. PÚBLICO', color: '#ea580c', icon: 'Briefcase' },
    { name: 'OUTRO', color: '#4b5563', icon: 'Tag' }
  ];
  try {
    for (const c of defs) await db.insert(demandCategories).values({ ...c, tenantId: tenantId! }).onConflictDoNothing();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const updateMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, phone, cep, bairro, birthDate } = req.body;
  try {
    const [u] = await db.update(municipes).set({ name, phone: normalizePhone(phone), cep, bairro, birthDate: birthDate ? new Date(birthDate) : null }).where(eq(municipes.id, id)).returning();
    res.json(u);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const deleteMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(municipes).where(eq(municipes.id, id));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const listMunicipes = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = req.query.limit === 'all' ? 10000 : (parseInt(req.query.limit as string) || 25);
  const search = req.query.search as string;
  const birthday = req.query.birthday === 'true';
  const offset = (page - 1) * limit;

  try {
    const conds = [eq(municipes.tenantId, tenantId!)];
    if (search) {
      conds.push(or(
        ilike(municipes.name, `%${search}%`), 
        ilike(municipes.phone, `%${search}%`),
        ilike(municipes.bairro, `%${search}%`)
      ) as any);
    }

    if (birthday) {
      // Filtro de aniversário para Postgres (dia e mês coincidem com hoje no fuso de Brasília)
      conds.push(sql`EXTRACT(DAY FROM ${municipes.birthDate}) = EXTRACT(DAY FROM CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')`);
      conds.push(sql`EXTRACT(MONTH FROM ${municipes.birthDate}) = EXTRACT(MONTH FROM CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')`);
    }

    const [totalCount] = await db.select({ count: count() })
      .from(municipes)
      .where(and(...conds));

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
    .where(and(...conds))
    .groupBy(municipes.id)
    .orderBy(municipes.name)
    .limit(limit)
    .offset(offset);

    res.json({ 
      data: results,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / (limit === 10000 ? 1 : limit))
      }
    });
  } catch (error: any) { 
    console.error('[LIST MUNICIPES ERROR]', error.message);
    res.status(500).json({ error: 'Failed' }); 
  }
};
