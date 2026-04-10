import { Router, Request, Response } from 'express';
import { normalizeEvolution } from '../services/whatsappService';
import { db } from '../db';
import { municipes, demandas } from '../db/schema';
import { processDemand } from '../services/aiService';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * Webhook endpoint for Evolution API.
 * Route: POST /api/webhook/evolution/:tenantId
 */
router.post('/evolution/:tenantId', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const payload = req.body;

  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    console.log('Normalized WhatsApp message:', JSON.stringify(normalized, null, 2));

    // 1. Check if the citizen (municipe) exists by phone and tenantId
    let [municipe] = await db.select()
      .from(municipes)
      .where(
        and(
          eq(municipes.phone, normalized.from),
          eq(municipes.tenantId, tenantId)
        )
      );

    // 2. Create a new citizen if not found
    if (!municipe) {
      [municipe] = await db.insert(municipes)
        .values({
          tenantId,
          name: normalized.name || 'Cidadão',
          phone: normalized.from,
        })
        .returning();
    }

    // 3. Call processDemand (AI Service) with the message text
    const aiResult = await processDemand(normalized.text);

    // 4. If AI processing succeeds, insert a new demanda linked to the citizen and tenant
    if (aiResult) {
      await db.insert(demandas)
        .values({
          tenantId,
          municipeId: municipe.id,
          categoria: aiResult.categoria,
          prioridade: aiResult.prioridade,
          resumoIa: aiResult.resumo_ia,
          status: 'nova',
        });
    }

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
