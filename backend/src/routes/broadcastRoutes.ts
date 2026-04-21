import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';
import { broadcasts, broadcastRecipients, municipes, demandas, globalCategories } from '../db/schema';
import { eq, and, desc, sql, isNotNull, asc } from 'drizzle-orm';
import { db } from '../db';
import { queueBroadcast, previewSegment, processQueue } from '../services/broadcastService';

const router = Router();

router.use(authenticate);
router.use(checkTenant);

// GET /api/broadcasts/segment-values?segmentType=bairro|categoria_demanda
router.get('/segment-values', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { segmentType } = req.query;

    if (segmentType === 'bairro') {
      const rows = await db
        .selectDistinct({ value: municipes.bairro })
        .from(municipes)
        .where(and(eq(municipes.tenantId, tenantId), isNotNull(municipes.bairro)));
      const values = rows.map(r => r.value).filter(Boolean).sort();
      return res.json(values);
    }

    if (segmentType === 'categoria_demanda') {
      const rows = await db
        .select({ name: globalCategories.name })
        .from(globalCategories)
        .orderBy(asc(globalCategories.order), asc(globalCategories.name));
      return res.json(rows.map(r => r.name.toUpperCase()));
    }

    return res.json([]);
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao buscar segment-values:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/broadcasts — cria rascunho
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, message, segmentType, segmentValue } = req.body;

    if (!name || !message || !segmentType) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, message, segmentType' });
    }

    const [broadcast] = await db
      .insert(broadcasts)
      .values({
        tenantId,
        name,
        message,
        segmentType,
        segmentValue: segmentValue ?? null,
        status: 'rascunho',
        createdBy: req.user!.id,
      })
      .returning();

    return res.status(201).json(broadcast);
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao criar:', err);
    return res.status(500).json({ error: 'Erro interno ao criar broadcast' });
  }
});

// GET /api/broadcasts — lista broadcasts do tenant
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const rows = await db
      .select()
      .from(broadcasts)
      .where(eq(broadcasts.tenantId, tenantId))
      .orderBy(desc(broadcasts.createdAt));

    return res.json(rows);
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao listar:', err);
    return res.status(500).json({ error: 'Erro interno ao listar broadcasts' });
  }
});

// PATCH /api/broadcasts/:id — atualiza segmento do rascunho
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);
    const { segmentType, segmentValue, mediaUrl } = req.body;

    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.tenantId, tenantId)))
      .limit(1);

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast não encontrado' });
    }

    if (broadcast.status !== 'rascunho') {
      return res.status(400).json({ error: 'Apenas rascunhos podem ser atualizados' });
    }

    const updates: Record<string, any> = {};
    if (segmentType) updates.segmentType = segmentType;
    if (segmentValue !== undefined) updates.segmentValue = segmentValue || null;
    if (mediaUrl !== undefined) updates.mediaUrl = mediaUrl || null;

    const [updated] = await db
      .update(broadcasts)
      .set(updates)
      .where(eq(broadcasts.id, id))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao atualizar:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar broadcast' });
  }
});

// GET /api/broadcasts/:id — detalhes de um broadcast (inclui progress)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.tenantId, tenantId)))
      .limit(1);

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast não encontrado' });
    }

    const [progress] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        enviados: sql<number>`COUNT(*) FILTER (WHERE ${broadcastRecipients.status} = 'enviado')`,
        pendentes: sql<number>`COUNT(*) FILTER (WHERE ${broadcastRecipients.status} = 'pendente')`,
        erros: sql<number>`COUNT(*) FILTER (WHERE ${broadcastRecipients.status} = 'erro')`,
      })
      .from(broadcastRecipients)
      .where(eq(broadcastRecipients.broadcastId, id));

    return res.json({ ...broadcast, progress });
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao buscar detalhes:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar broadcast' });
  }
});

// GET /api/broadcasts/:id/preview — preview do segmento
router.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.tenantId, tenantId)))
      .limit(1);

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast não encontrado' });
    }

    const result = await previewSegment(tenantId, broadcast.segmentType, broadcast.segmentValue ?? undefined);

    return res.json(result);
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao gerar preview:', err);
    return res.status(500).json({ error: 'Erro interno ao gerar preview' });
  }
});

// POST /api/broadcasts/:id/send — enfileira e processa em background
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.tenantId, tenantId)))
      .limit(1);

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast não encontrado' });
    }

    if (broadcast.status !== 'rascunho') {
      return res.status(400).json({ error: 'Apenas broadcasts em rascunho podem ser enviados' });
    }

    await queueBroadcast(id);

    processQueue().catch(err => console.error('[BROADCAST] Erro ao processar fila:', err));

    return res.json({ status: 'enfileirado', message: 'Broadcast enfileirado para envio' });
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao enfileirar:', err);
    return res.status(500).json({ error: 'Erro interno ao enfileirar broadcast' });
  }
});

// POST /api/broadcasts/:id/cancel — cancela broadcast
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = String(req.params.id);

    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.tenantId, tenantId)))
      .limit(1);

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast não encontrado' });
    }

    const cancelableStatuses = ['rascunho', 'enfileirado', 'enviando'];
    if (!cancelableStatuses.includes(broadcast.status)) {
      return res.status(400).json({ error: `Não é possível cancelar um broadcast com status "${broadcast.status}"` });
    }

    const [updated] = await db
      .update(broadcasts)
      .set({ status: 'cancelado' })
      .where(eq(broadcasts.id, id))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    console.error('[BROADCAST] Erro ao cancelar:', err);
    return res.status(500).json({ error: 'Erro interno ao cancelar broadcast' });
  }
});

export default router;
