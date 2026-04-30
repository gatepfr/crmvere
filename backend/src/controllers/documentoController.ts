import type { Request, Response } from 'express';
import { db } from '../db';
import { documentos, municipes } from '../db/schema';
import { eq, and, ilike, desc, count, or, isNotNull } from 'drizzle-orm';

export const listDocumentos = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const tipo = req.query.tipo as string;
  const status = req.query.status as string;
  const origem = req.query.origem as string;
  const offset = (page - 1) * limit;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const conditions: any[] = [eq(documentos.tenantId, tenantId)];
    if (tipo) conditions.push(eq(documentos.tipo, tipo as any));
    if (status) conditions.push(eq(documentos.status, status as any));
    if (origem) conditions.push(eq(documentos.origem, origem as any));
    if (search) {
      conditions.push(or(
        ilike(documentos.categoria, `%${search}%`),
        ilike(municipes.name, `%${search}%`)
      ) as any);
    }

    const [totalCount] = await db
      .select({ count: count() })
      .from(documentos)
      .leftJoin(municipes, eq(documentos.municipeId, municipes.id))
      .where(and(...conditions));

    const results = await db
      .select({
        documento: documentos,
        municipe: { id: municipes.id, name: municipes.name, phone: municipes.phone },
      })
      .from(documentos)
      .leftJoin(municipes, eq(documentos.municipeId, municipes.id))
      .where(and(...conditions))
      .orderBy(desc(documentos.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      data: results,
      pagination: { page, limit, total: Number(totalCount?.count || 0), totalPages: Math.ceil(Number(totalCount?.count || 0) / limit) },
    });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const getCategorias = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const results = await db
      .selectDistinct({ categoria: documentos.categoria })
      .from(documentos)
      .where(and(eq(documentos.tenantId, tenantId), isNotNull(documentos.categoria)));
    const categorias = results.map(r => r.categoria).filter(Boolean).sort();
    res.json(categorias);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const createDocumento = async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  if (!tenantId || !userId) return res.status(403).json({ error: 'No tenant context' });
  const { tipo, categoria, descricao, origem, municipeId, numeroDocumento, documentUrl, status } = req.body;
  if (!tipo || !categoria || !origem) return res.status(400).json({ error: 'tipo, categoria e origem são obrigatórios' });
  try {
    const [newDoc] = await db.insert(documentos).values({
      tenantId,
      criadoPor: userId,
      tipo,
      categoria,
      descricao: descricao || null,
      origem,
      municipeId: municipeId || null,
      numeroDocumento: numeroDocumento || null,
      documentUrl: documentUrl || null,
      status: status || 'criado',
    }).returning();
    res.status(201).json(newDoc);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const updateDocumento = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const { tipo, categoria, descricao, origem, municipeId, numeroDocumento, documentUrl, status } = req.body;
  try {
    const updateData: any = { updatedAt: new Date() };
    if (tipo !== undefined) updateData.tipo = tipo;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (origem !== undefined) updateData.origem = origem;
    if (municipeId !== undefined) updateData.municipeId = municipeId || null;
    if (numeroDocumento !== undefined) updateData.numeroDocumento = numeroDocumento;
    if (documentUrl !== undefined) updateData.documentUrl = documentUrl;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db.update(documentos).set(updateData)
      .where(and(eq(documentos.id, id), eq(documentos.tenantId, tenantId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Documento não encontrado' });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};

export const deleteDocumento = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const [deleted] = await db.delete(documentos)
      .where(and(eq(documentos.id, id), eq(documentos.tenantId, tenantId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Documento não encontrado' });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
};
