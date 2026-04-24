import type { Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, systemConfigs, tenants, demandCategories, globalCategories, atendimentos, users, demandComments, demandActivityLog } from '../db/schema';
import { eq, desc, asc, and, sql, count, ilike, or, lt, isNull } from 'drizzle-orm';
import { normalizePhone } from '../utils/phoneUtils';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

/**
 * MUNÍCIPES
 */
export const createMunicipe = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, phone, cep, bairro, birthDate, isLideranca } = req.body;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const [newMunicipe] = await db.insert(municipes).values({
      tenantId, name, phone: normalizePhone(phone), cep, bairro,
      birthDate: birthDate ? new Date(birthDate) : null,
      isLideranca: isLideranca || false
    }).returning();
    res.status(201).json(newMunicipe);
  } catch (error: any) {
    if (error.code === '23505') return res.status(400).json({ error: 'Este número de telefone já está cadastrado.' });
    res.status(500).json({ error: 'Failed' });
  }
};

export const listBairros = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const rows = await db
      .selectDistinct({ bairro: municipes.bairro })
      .from(municipes)
      .where(and(eq(municipes.tenantId, tenantId), sql`${municipes.bairro} is not null`))
      .orderBy(asc(municipes.bairro));
    res.json(rows.map(r => r.bairro).filter(Boolean));
  } catch { res.status(500).json({ error: 'Failed' }); }
};

export const listMunicipes = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = req.query.limit === 'all' ? 10000 : (parseInt(req.query.limit as string) || 25);
  const search = req.query.search as string;
  const birthday = req.query.birthday === 'true';
  const isLiderancaFilter = req.query.lideranca === 'true';
  const bairroFilter = req.query.bairro as string;
  const sortBy = (req.query.sortBy as string) || 'name';
  const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
  const offset = (page - 1) * limit;

  const sortColumn: Record<string, any> = {
    name: municipes.name,
    phone: municipes.phone,
    bairro: municipes.bairro,
    createdAt: municipes.createdAt,
    demandCount: sql`count(${demandas.id})::int`,
  };
  const orderCol = sortColumn[sortBy] ?? municipes.name;
  const orderExpr = sortOrder === 'desc' ? desc(orderCol) : asc(orderCol);

  try {
    const conds = [eq(municipes.tenantId, tenantId!)];
    if (search) {
      conds.push(or(ilike(municipes.name, `%${search}%`), ilike(municipes.phone, `%${search}%`)) as any);
    }
    if (birthday) {
      conds.push(sql`to_char(${municipes.birthDate}, 'DD-MM') = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD-MM')`);
    }
    if (isLiderancaFilter) {
      conds.push(eq(municipes.isLideranca, true));
    }
    if (bairroFilter) {
      conds.push(eq(municipes.bairro, bairroFilter));
    }
    const [totalCount] = await db.select({ count: count() }).from(municipes).where(and(...conds));
    const results = await db.select({
      id: municipes.id, name: municipes.name, phone: municipes.phone, bairro: municipes.bairro,
      birthDate: municipes.birthDate, createdAt: municipes.createdAt, isLideranca: municipes.isLideranca,
      demandCount: sql<number>`count(${demandas.id})::int`
    }).from(municipes).leftJoin(demandas, eq(municipes.id, demandas.municipeId)).where(and(...conds)).groupBy(municipes.id).orderBy(orderExpr).limit(limit).offset(offset);

    res.json({ data: results, pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / (limit === 10000 ? 1 : limit)) } });
  } catch (error: any) { res.status(500).json({ error: 'Failed' }); }
};

export const updateMunicipe = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, phone, cep, bairro, birthDate, isLideranca } = req.body;
  try {
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = normalizePhone(phone);
    if (cep !== undefined) updateData.cep = cep;
    if (bairro !== undefined) updateData.bairro = bairro;
    if (birthDate !== undefined) updateData.birthDate = birthDate ? new Date(birthDate) : null;
    if (isLideranca !== undefined) updateData.isLideranca = isLideranca;
    const [u] = await db.update(municipes).set(updateData).where(eq(municipes.id, id)).returning();
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

/**
 * ATENDIMENTOS (WHATSAPP)
 */
export const listAtendimentos = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const attention = req.query.attention === 'true';
  const sortBy = (req.query.sortBy as string) || 'atendimentos.updatedAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const offset = (page - 1) * limit;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  const sortColumn: Record<string, any> = {
    'municipes.name': municipes.name,
    'atendimentos.categoria': atendimentos.categoria,
    'atendimentos.prioridade': atendimentos.prioridade,
    'atendimentos.updatedAt': atendimentos.updatedAt,
    'atendimentos.createdAt': atendimentos.createdAt,
  };
  const orderCol = sortColumn[sortBy] ?? atendimentos.updatedAt;
  const orderExpr = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);

  try {
    const conditions = [eq(atendimentos.tenantId, tenantId)];
    if (attention) conditions.push(eq(atendimentos.precisaRetorno, true));
    if (search) {
      conditions.push(or(ilike(municipes.name, `%${search}%`), ilike(municipes.phone, `%${search}%`), ilike(municipes.bairro, `%${search}%`)) as any);
    }
    const [totalCount] = await db.select({ count: count() }).from(atendimentos).innerJoin(municipes, eq(atendimentos.municipeId, municipes.id)).where(and(...conditions));
    const results = await db.select({ atendimentos: atendimentos, municipes: municipes }).from(atendimentos).innerJoin(municipes, eq(atendimentos.municipeId, municipes.id)).where(and(...conditions)).orderBy(orderExpr).limit(limit).offset(offset);
    res.json({ data: results, pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / limit) } });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const updateAtendimento = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { precisaRetorno, status, categoria, prioridade } = req.body;
  const tenantId = req.user?.tenantId;
  try {
    const updateData: any = { updatedAt: new Date() };
    if (status === 'concluida') updateData.precisaRetorno = false;
    else if (precisaRetorno !== undefined) updateData.precisaRetorno = precisaRetorno;
    if (categoria) updateData.categoria = categoria;
    if (prioridade) updateData.prioridade = prioridade;

    await db.update(atendimentos).set(updateData).where(and(eq(atendimentos.id, id), eq(atendimentos.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const deleteAtendimento = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  try {
    await db.delete(atendimentos).where(and(eq(atendimentos.id, id), eq(atendimentos.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

/**
 * DEMANDAS OFICIAIS
 */
export const listDemands = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const status = req.query.status as string;
  const overdue = req.query.overdue === 'true';
  const unassigned = req.query.unassigned === 'true';
  const offset = (page - 1) * limit;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const conditions = [eq(demandas.tenantId, tenantId)];
    if (category) conditions.push(eq(demandas.categoria, category));
    if (status) conditions.push(eq(demandas.status, status as any));
    if (overdue) {
      conditions.push(lt(demandas.dueDate, new Date()));
      conditions.push(sql`${demandas.status} != 'concluida'`);
    }
    if (unassigned) conditions.push(isNull(demandas.assignedToId));
    if (search) {
      conditions.push(or(ilike(municipes.name, `%${search}%`), ilike(municipes.phone, `%${search}%`), ilike(municipes.bairro, `%${search}%`)) as any);
    }
    const assignedUser = { id: users.id, email: users.email };
    const [totalCount] = await db.select({ count: count() }).from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id)).where(and(...conditions));
    const results = await db
      .select({ demandas: demandas, municipes: municipes, assignedTo: { id: users.id, email: users.email } })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .leftJoin(users, eq(demandas.assignedToId, users.id))
      .where(and(...conditions))
      .orderBy(desc(demandas.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ data: results, pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / limit) } });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const listMyDemands = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  if (!tenantId || !userId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const results = await db
      .select({ demandas: demandas, municipes: municipes })
      .from(demandas)
      .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(and(eq(demandas.tenantId, tenantId), eq(demandas.assignedToId, userId)))
      .orderBy(asc(demandas.dueDate), desc(demandas.createdAt));
    res.json(results);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const assignDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId } = req.body;
  const tenantId = req.user?.tenantId;
  const actorId = req.user?.id;
  if (!tenantId || !actorId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const [existing] = await db.select({ assignedToId: demandas.assignedToId }).from(demandas).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId)));
    if (!existing) return res.status(404).json({ error: 'Demand not found' });

    await db.update(demandas).set({
      assignedToId: userId || null,
      assignedAt: userId ? new Date() : null,
      updatedAt: new Date()
    }).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId)));

    await db.insert(demandActivityLog).values({
      demandId: id, userId: actorId, action: 'assigned',
      oldValue: existing.assignedToId || null,
      newValue: userId || null
    });

    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const addDemandComment = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { comment } = req.body;
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  if (!tenantId || !userId) return res.status(403).json({ error: 'No tenant context' });
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });
  try {
    const [newComment] = await db.insert(demandComments).values({ demandId: id, userId, comment: comment.trim() }).returning();
    res.status(201).json(newComment);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const getDemandTimeline = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const comments = await db
      .select({ id: demandComments.id, type: sql<string>`'comment'`, content: demandComments.comment, userId: demandComments.userId, userEmail: users.email, createdAt: demandComments.createdAt })
      .from(demandComments)
      .leftJoin(users, eq(demandComments.userId, users.id))
      .where(eq(demandComments.demandId, id));

    const activities = await db
      .select({ id: demandActivityLog.id, type: sql<string>`'activity'`, content: sql<string>`concat(${demandActivityLog.action}, ': ', coalesce(${demandActivityLog.oldValue}, 'null'), ' -> ', coalesce(${demandActivityLog.newValue}, 'null'))`, userId: demandActivityLog.userId, userEmail: users.email, action: demandActivityLog.action, oldValue: demandActivityLog.oldValue, newValue: demandActivityLog.newValue, createdAt: demandActivityLog.createdAt })
      .from(demandActivityLog)
      .leftJoin(users, eq(demandActivityLog.userId, users.id))
      .where(eq(demandActivityLog.demandId, id));

    const timeline = [...comments, ...activities].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json(timeline);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
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
        } else { finalMunicipeId = existing.id; }
      }
      const [newDemand] = await tx.insert(demandas).values({
        tenantId, municipeId: finalMunicipeId, atendimentoId: atendimentoId || null,
        categoria: categoria || 'outro', prioridade: prioridade || 'media',
        descricao: resumoIa, status: 'nova'
      }).returning();
      return newDemand;
    });
    res.status(201).json(result);
  } catch (error) { res.status(500).json({ error: 'Failed to create demand' }); }
};

export const updateDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { status, resumoIa, prioridade, categoria, isLegislativo, numeroIndicacao, documentUrl, dueDate } = req.body;
  const tenantId = req.user?.tenantId;
  const actorId = req.user?.id;
  try {
    const [existing] = await db.select({ status: demandas.status }).from(demandas).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
    const updateData: any = { updatedAt: new Date() };
    if (status) {
      updateData.status = status;
      if (status === 'concluida') updateData.closedAt = new Date();
    }
    if (prioridade) updateData.prioridade = prioridade;
    if (categoria) updateData.categoria = categoria;
    if (resumoIa) updateData.descricao = resumoIa;
    if (isLegislativo !== undefined) updateData.isLegislativo = isLegislativo;
    if (numeroIndicacao !== undefined) updateData.numeroIndicacao = numeroIndicacao;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    await db.update(demandas).set(updateData).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
    if (status && existing?.status !== status && actorId) {
      await db.insert(demandActivityLog).values({ demandId: id, userId: actorId, action: 'status_changed', oldValue: existing?.status || null, newValue: status });
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

/**
 * CATEGORIAS — lidas da tabela global gerenciada pelo superadmin
 */
export const listCategories = async (_req: Request, res: Response) => {
  try {
    const cats = await db.select().from(globalCategories).orderBy(asc(globalCategories.order));
    res.json(cats);
  } catch (error) { res.status(500).json({ error: 'Failed to list categories' }); }
};

// Mantido por compatibilidade de rota, não faz mais nada
export const createCategory = async (_req: Request, res: Response) => {
  res.status(400).json({ error: 'Categories are managed globally by the superadmin' });
};

export const deleteCategory = async (_req: Request, res: Response) => {
  res.status(400).json({ error: 'Categories are managed globally by the superadmin' });
};

export const seedCategories = async (_req: Request, res: Response) => {
  try {
    const cats = await db.select().from(globalCategories).orderBy(asc(globalCategories.order));
    res.json(cats);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

/**
 * IMPORTAÇÃO E UTILITÁRIOS
 */
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

export const deleteDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  try {
    await db.delete(demandas).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const getDemand = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.user?.tenantId;
  try {
    const [demand] = await db.select({ demandas: demandas, municipes: municipes }).from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id)).where(and(eq(demandas.id, id), eq(demandas.tenantId, tenantId!)));
    if (!demand) return res.status(404).json({ error: 'Demand not found' });
    res.status(200).json(demand);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};
