import { Router, Request, Response } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
import { normalizeEvolution } from '../services/whatsappService';
import { db } from '../db';
import { tenants, municipes, demandas, documents } from '../db/schema';
import { processDemand } from '../services/aiService';
import { EvolutionService } from '../services/evolutionService';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

/**
 * Stripe Webhook endpoint.
 * Route: POST /api/webhook/stripe
 */
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

/**
 * Health check/Ping endpoint.
 */
router.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * Webhook endpoint for Evolution API.
 * Route: POST /api/webhook/evolution/:tenantId
 * Note: Supporting both base and sub-paths for Evolution API v2 events
 */
router.post(['/evolution/:tenantId', '/evolution/:tenantId/:eventName'], express.json(), async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  const payload = req.body;

  console.log(`[WEBHOOK] Incoming from tenant ${tenantId} (Event: ${payload?.event || 'unknown'})`);
  console.log(`[WEBHOOK] Full URL Path: ${req.originalUrl}`);
  console.log(`[WEBHOOK] Payload structure:`, JSON.stringify(payload, null, 2).substring(0, 500));

  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    // 1. Only process new messages (upsert)
    const validEvents = ['MESSAGES_UPSERT', 'messages.upsert', 'MESSAGES_CREATE', 'messages.create'];
    if (!validEvents.includes(normalized.event) && normalized.event !== 'unknown') {
      return res.status(200).json({ status: 'ignored_event', event: normalized.event });
    }

    // 2. Ignore messages sent by the bot itself
    if (normalized.fromMe) {
      return res.status(200).json({ status: 'ignored_from_me' });
    }

    // 3. Ignore Group/Broadcast/Newsletter Messages
    if (normalized.isGroup) {
      console.log(`[WEBHOOK] Ignoring group/broadcast message from ${normalized.from}`);
      return res.status(200).json({ status: 'ignored_group' });
    }
    
    if (!normalized.text || normalized.text.trim() === '') {
      return res.status(200).json({ status: 'ignored_no_text' });
    }

    console.log(`[WEBHOOK] Valid message from ${normalized.from}: "${normalized.text.substring(0, 50)}..."`);

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

    // 1. Get/Create Citizen (Munícipe Único)
    const cleanPhone = normalized.from.replace(/\D/g, ''); // Ensure search is only numbers
    let [municipe] = await db.select().from(municipes).where(
      and(
        eq(municipes.phone, cleanPhone), 
        eq(municipes.tenantId, tenantId)
      )
    );

    if (!municipe) {
      const [newMunicipe] = await db.insert(municipes).values({ 
        tenantId, 
        name: normalized.name || 'Cidadão', 
        phone: cleanPhone 
      }).returning();
      municipe = newMunicipe;
    } else if (normalized.name && municipe.name === 'Cidadão') {
      // If we already had the phone but now we have a real name, update it
      await db.update(municipes).set({ name: normalized.name }).where(eq(municipes.id, municipe.id));
      municipe.name = normalized.name;
    }

    // 2. Get LATEST open demand (created TODAY since 00:00 AND status is active)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let [existingDemanda] = await db.select()
      .from(demandas)
      .where(and(
        eq(demandas.municipeId, municipe.id), 
        eq(demandas.tenantId, tenantId), 
        sql`${demandas.status} IN ('nova', 'em_andamento')`
      ))
      .orderBy(desc(demandas.updatedAt))
      .limit(1);

    // If the latest active demand was NOT created today, start a NEW one
    if (existingDemanda && existingDemanda.createdAt < todayStart) {
      existingDemanda = undefined;
    }

    // 3. Build Full Conversation Context
    // We keep the raw messages in the context to prevent the AI from losing its personality
    let conversationHistory = existingDemanda?.resumoIa || '';
    let promptContext = conversationHistory ? `${conversationHistory}\nCidadão: ${normalized.text}` : `Cidadão: ${normalized.text}`;

    // Truncate context if it gets too long (max 10000 in DB, we use 9000 as safety threshold)
    if (promptContext.length > 9000) {
      console.log(`[WEBHOOK] Truncating history for tenant ${tenantId} (current length: ${promptContext.length})`);
      promptContext = "..." + promptContext.substring(promptContext.length - 5000);
    }

    // New: Check for Human Intervention (Silence AI for 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const history = existingDemanda?.resumoIa || '';
    
    // Check if "Gabinete:" appears after the last "AI:" response
    const lastGabineteIndex = history.lastIndexOf('Gabinete:');
    const lastAIIndex = history.lastIndexOf('AI:');
    const isHumanLastSpeaker = lastGabineteIndex > lastAIIndex;
    const wasRecentlyUpdatedByHuman = existingDemanda && existingDemanda.updatedAt && existingDemanda.updatedAt > tenMinutesAgo;

    console.log(`[WEBHOOK] Human Intervention Check - tenantId: ${tenantId}`);
    console.log(`[WEBHOOK]   history: "${history.substring(0, 100)}"`);
    console.log(`[WEBHOOK]   lastGabineteIndex: ${lastGabineteIndex}`);
    console.log(`[WEBHOOK]   lastAIIndex: ${lastAIIndex}`);
    console.log(`[WEBHOOK]   isHumanLastSpeaker: ${isHumanLastSpeaker}`);
    console.log(`[WEBHOOK]   existingDemanda.updatedAt: ${existingDemanda?.updatedAt}`);
    console.log(`[WEBHOOK]   tenMinutesAgo: ${tenMinutesAgo}`);
    console.log(`[WEBHOOK]   wasRecentlyUpdatedByHuman: ${wasRecentlyUpdatedByHuman}`);

    if (isHumanLastSpeaker && wasRecentlyUpdatedByHuman) {
      console.log(`[WEBHOOK] AI is SILENCED by Human Intervention logic for tenant ${tenantId}.`);
      console.log(`[WEBHOOK] AI is SILENCED for tenant ${tenantId} because human was the last speaker in the last 10 min.`);
      return res.status(200).json({ status: 'ignored_human_active' });
    }

    // 4. AI Processing
    let aiResult = null;
    const apiKey = tenant?.aiApiKey || process.env.GEMINI_API_KEY;
    console.log(`[WEBHOOK] AI Start - apiKey present: ${!!apiKey}`);
    if (apiKey) {
      try {
        aiResult = await processDemand(promptContext, {
          provider: tenant?.aiProvider as any || 'gemini',
          apiKey: apiKey,
          model: tenant?.aiModel || (tenant?.aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o'),
          aiBaseUrl: tenant?.aiBaseUrl || undefined,
          systemPrompt: tenant?.systemPrompt || ''
        }, undefined, knowledgeBaseContent);
        console.log(`[WEBHOOK] AI Result: "${aiResult?.resposta_usuario?.substring(0, 50)}..."`);
      } catch (aiError: any) {
        console.error('[WEBHOOK] AI Error:', aiError.message);
      }
    } else {
      console.warn(`[WEBHOOK] No API Key for tenant ${tenantId}. AI will not process.`);
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
          updatedAt: new Date(), // Update the timestamp
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
      console.log(`[WEBHOOK] Sending AI response to ${normalized.jid} via instance ${tenant.whatsappInstanceId}`);
      const evolution = new EvolutionService(
        tenant.evolutionApiUrl || 'http://localhost:8080',
        tenant.evolutionGlobalToken || 'mestre123'
      );
      
      // Send main response to citizen
      await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario)
        .then(() => console.log(`[WEBHOOK] AI message sent successfully to ${normalized.jid}`))
        .catch(e => console.error(`[WEBHOOK] Send Error to ${normalized.jid}:`, e.message));

      // 7. ALERT HUMAN if needed
      if (aiResult?.precisa_retorno && tenant.whatsappNotificationNumber) {
        console.log(`[WEBHOOK] Alerting human at ${tenant.whatsappNotificationNumber}`);
        
        // Clean up the summary from AI (remove markdown bold markers)
        const cleanSummary = aiResult.resumo_ia?.replace(/\*\*/g, '').replace(/\*/g, '') || 'Sem resumo disponível';
        
        const alertMsg = `🚨 ALERTA DE ATENDIMENTO HUMANO\n\n` +
                        `Cidadão: ${municipe.name}\n` +
                        `Telefone: ${normalized.from}\n` +
                        `Bairro: ${municipe.bairro || 'Não informado'}\n\n` +
                        `RESUMO DA DEMANDA:\n${cleanSummary}\n\n` +
                        `O cidadão solicitou atenção humana ou a IA não soube responder. Acesse o painel para assumir.`;
        
        await evolution.sendMessage(tenant.whatsappInstanceId, tenant.whatsappNotificationNumber, alertMsg)
          .catch(e => console.error('[WEBHOOK] Alert Send Error:', e.message));
      }
    } else {
      console.warn(`[WEBHOOK] Skip sending message: AI Resposta: ${!!aiResult?.resposta_usuario}, InstanceId: ${tenant.whatsappInstanceId}`);
    }

    res.status(200).json({ status: 'received' });
  } catch (error: any) {
    console.error('[WEBHOOK] Fatal Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
