import { Router, Request, Response } from 'express';
import { normalizeEvolution } from '../services/whatsappService';
import { db } from '../db';
import { tenants, municipes, demandas, documents } from '../db/schema';
import { processDemand } from '../services/aiService';
import { EvolutionService } from '../services/evolutionService';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

/**
 * Webhook endpoint for Evolution API.
 * Route: POST /api/webhook/evolution/:tenantId
 */
router.post('/evolution/:tenantId', async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  const payload = req.body;

  console.log(`[WEBHOOK] Incoming from tenant ${tenantId}`);

  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    if (!normalized.text || normalized.text === '') {
      return res.status(200).json({ status: 'ignored_no_text' });
    }

    console.log(`[WEBHOOK] Message: "${normalized.text}" from ${normalized.from}`);

    // Fetch tenant config
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Fetch knowledge base
    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    let knowledgeBaseContent = tenantDocs
      .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
      .join('\n\n');

    if (knowledgeBaseContent.length > 10000) {
      knowledgeBaseContent = knowledgeBaseContent.substring(0, 10000) + '...';
    }

    // 1. Get/Create Citizen
    let [municipe] = await db.select().from(municipes).where(and(eq(municipes.phone, normalized.from), eq(municipes.tenantId, tenantId)));
    if (!municipe) {
      const [newMunicipe] = await db.insert(municipes).values({ tenantId, name: normalized.name || 'Cidadão', phone: normalized.from }).returning();
      municipe = newMunicipe;
    }

    // 2. Get LATEST open demand (DESC order)
    let [existingDemanda] = await db.select()
      .from(demandas)
      .where(and(eq(demandas.municipeId, municipe.id), eq(demandas.tenantId, tenantId), eq(demandas.status, 'nova')))
      .orderBy(desc(demandas.createdAt))
      .limit(1);

    // 3. Build Full Conversation Context
    // We keep the raw messages in the context to prevent the AI from losing its personality
    let conversationHistory = existingDemanda?.resumoIa || '';
    let promptContext = conversationHistory ? `${conversationHistory}\nCidadão: ${normalized.text}` : `Cidadão: ${normalized.text}`;

    // 4. AI Processing
    let aiResult = null;
    const apiKey = tenant?.aiApiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        aiResult = await processDemand(promptContext, {
          provider: tenant?.aiProvider as any || 'gemini',
          apiKey: apiKey,
          model: tenant?.aiModel || (tenant?.aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o'),
          aiBaseUrl: tenant?.aiBaseUrl || undefined,
          systemPrompt: tenant?.systemPrompt || ''
        }, undefined, knowledgeBaseContent);
      } catch (aiError: any) {
        console.error('[WEBHOOK] AI Error:', aiError.message);
      }
    }

    // 5. Save updated conversation to database
    // IMPORTANT: We store the ACTUAL dialogue, not just the technical summary, to keep context
    const updatedHistory = `${promptContext}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;

    if (existingDemanda) {
      await db.update(demandas)
        .set({
          resumoIa: updatedHistory, // Now resumoIa stores the conversation log
          categoria: aiResult?.categoria || existingDemanda.categoria,
          prioridade: aiResult?.prioridade || existingDemanda.prioridade,
          precisaRetorno: aiResult?.precisa_retorno || existingDemanda.precisaRetorno,
        })
        .where(eq(demandas.id, existingDemanda.id));
    } else {
      await db.insert(demandas)
        .values({
          tenantId,
          municipeId: municipe.id,
          categoria: aiResult?.categoria || 'outro',
          prioridade: aiResult?.prioridade || 'media',
          resumoIa: updatedHistory,
          status: 'nova',
          precisaRetorno: aiResult?.precisa_retorno || false,
        });
    }

    // 6. Send WhatsApp Response
    if (aiResult?.resposta_usuario && tenant.whatsappInstanceId) {
      const evolution = new EvolutionService(
        tenant.evolutionApiUrl || 'http://localhost:8080',
        tenant.evolutionGlobalToken || 'mestre123'
      );
      
      // Send main response to citizen
      await evolution.sendMessage(tenant.whatsappInstanceId, normalized.from, aiResult.resposta_usuario)
        .catch(e => console.error('[WEBHOOK] Send Error:', e.message));

      // 7. ALERT HUMAN if needed
      if (aiResult?.precisa_retorno && tenant.whatsappNotificationNumber) {
        const alertMsg = `🚨 *ALERTA DE ATENDIMENTO HUMANO*\n\n*Munícipe:* ${municipe.name}\n*Telefone:* ${normalized.from}\n*Bairro:* ${municipe.bairro || 'Não informado'}\n*Resumo:* ${aiResult.resumo_ia}\n\nO cidadão solicitou atenção humana ou a IA não soube responder. Acesse o painel para assumir.`;
        
        await evolution.sendMessage(tenant.whatsappInstanceId, tenant.whatsappNotificationNumber, alertMsg)
          .catch(e => console.error('[WEBHOOK] Alert Send Error:', e.message));
      }
    }

    res.status(200).json({ status: 'received' });
  } catch (error: any) {
    console.error('[WEBHOOK] Fatal Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
