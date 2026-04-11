import { Router, Request, Response } from 'express';
import { normalizeEvolution } from '../services/whatsappService';
import { db } from '../db';
import { tenants, municipes, demandas, documents } from '../db/schema';
import { processDemand } from '../services/aiService';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * Webhook endpoint for Evolution API.
 * Route: POST /api/webhook/evolution/:tenantId
 */
router.post('/evolution/:tenantId', async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
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
    
    // Fetch tenant config and knowledge base
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    
    const knowledgeBaseContent = tenantDocs
      .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
      .join('\n\n');

    // 2. Create a new citizen if not found
    if (!municipe) {
      const [newMunicipe] = await db.insert(municipes)
        .values({
          tenantId,
          name: normalized.name || 'Cidadão',
          phone: normalized.from,
        })
        .returning();
      municipe = newMunicipe;
    }

    // 3. Call processDemand (AI Service) with the message text, tenant config and RAG content
    const aiResult = await processDemand(normalized.text, {
      apiKey: tenant?.geminiApiKey || process.env.GEMINI_API_KEY || '',
      model: tenant?.aiModel || 'gemini-1.5-flash',
      systemPrompt: tenant?.systemPrompt || ''
    }, undefined, knowledgeBaseContent);

    // 4. If AI processing succeeds, insert a new demanda linked to the citizen and tenant
    if (aiResult && municipe) {
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
