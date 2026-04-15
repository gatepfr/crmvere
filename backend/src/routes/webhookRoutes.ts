import { Router, Request, Response } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
import { normalizeEvolution } from '../services/whatsappService';
import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs } from '../db/schema';
import { processDemand } from '../services/aiService';
import { EvolutionService } from '../services/evolutionService';
import { normalizePhone } from '../utils/phoneUtils';
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
router.post('/evolution/:tenantId', express.json(), async (req: Request, res: Response) => {
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

    // 0. RESPONDER IMEDIATAMENTE para evitar duplicidade (Evolution API retry)
    res.status(200).json({ status: 'received', processing: true });

    // 1. Processar em background (IIFE)
    (async () => {
      try {
        // Fetch tenant config
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
        if (!tenant) return;

        // Fetch knowledge base
        const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
        let knowledgeBaseContent = tenantDocs
          .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
          .join('\n\n');

        if (knowledgeBaseContent.length > 10000) {
          knowledgeBaseContent = knowledgeBaseContent.substring(0, 10000) + '...';
        }

        // 2. Get/Create Citizen
        const cleanPhone = normalizePhone(normalized.from);
        let [municipe] = await db.select().from(municipes).where(
          and(eq(municipes.phone, cleanPhone), eq(municipes.tenantId, tenantId))
        );

        if (!municipe) {
          const [newMunicipe] = await db.insert(municipes).values({ 
            tenantId, 
            name: normalized.name || 'Cidadão', 
            phone: cleanPhone 
          }).returning();
          municipe = newMunicipe;
        }

        // 3. Get LATEST active demand
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

        if (existingDemanda && existingDemanda.createdAt < todayStart) {
          existingDemanda = undefined;
        }

        // 4. Human Intervention Check
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const history = existingDemanda?.resumoIa || '';
        const lastGabineteIndex = history.lastIndexOf('Gabinete:');
        const lastAIIndex = history.lastIndexOf('AI:');
        const isHumanLastSpeaker = lastGabineteIndex > lastAIIndex;
        const wasRecentlyUpdatedByHuman = existingDemanda && existingDemanda.updatedAt && existingDemanda.updatedAt > tenMinutesAgo;

        if (isHumanLastSpeaker && wasRecentlyUpdatedByHuman) {
          console.log(`[WEBHOOK] IA silenciada (intervenção humana) para ${tenantId}`);
          return;
        }

        // 5. AI Processing
        const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
        const provider = tenant?.aiProvider || globalConfig?.aiProvider || 'gemini';
        const apiKey = tenant?.aiApiKey || globalConfig?.aiApiKey || process.env.GEMINI_API_KEY;
        const model = tenant?.aiModel || globalConfig?.aiModel || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o');

        if (!apiKey) {
          console.warn(`[WEBHOOK] Falta API Key para tenant ${tenantId}`);
          return;
        }

        let conversationHistory = existingDemanda?.resumoIa || '';
        let promptContext = conversationHistory ? `${conversationHistory}\nCidadão: ${normalized.text}` : `Cidadão: ${normalized.text}`;

        const aiResultRaw = await processDemand(promptContext, {
          provider: provider as any,
          apiKey: apiKey,
          model: model,
          aiBaseUrl: tenant?.aiBaseUrl || globalConfig?.aiBaseUrl,
          systemPrompt: tenant?.systemPrompt || ''
        }, undefined, knowledgeBaseContent);

        const aiResult = aiResultRaw.data;
        const updatedHistory = `${promptContext}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;

        // 6. Save/Update Demand
        if (existingDemanda) {
          await db.update(demandas).set({
            resumoIa: updatedHistory,
            categoria: aiResult?.categoria || existingDemanda.categoria,
            prioridade: aiResult?.prioridade || existingDemanda.prioridade,
            precisaRetorno: aiResult?.precisa_retorno || existingDemanda.precisaRetorno,
            updatedAt: new Date(),
          }).where(eq(demandas.id, existingDemanda.id));
        } else {
          await db.insert(demandas).values({
            tenantId,
            municipeId: municipe.id,
            categoria: aiResult?.categoria || 'outro',
            prioridade: aiResult?.prioridade || 'media',
            resumoIa: updatedHistory,
            status: 'nova',
            precisaRetorno: aiResult?.precisa_retorno || false,
          });
        }

        // 7. Enviar resposta via WhatsApp (Evolution API)
        if (aiResult?.resposta_usuario && tenant.whatsappInstanceId) {
          const evoUrl = tenant.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
          // Tenta todos os possíveis nomes de token para garantir compatibilidade
          const evoToken = tenant.evolutionGlobalToken || 
                           process.env.EVOLUTION_API_TOKEN || 
                           process.env.EVOLUTION_GLOBAL_TOKEN || 
                           process.env.WA_API_KEY || 
                           'mestre123';

          const evolution = new EvolutionService(evoUrl, evoToken);
          await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario);
          console.log(`[WEBHOOK] ✅ IA respondeu munícipe via WhatsApp.`);
        }
      } catch (err: any) {
        console.error('[WEBHOOK BACKGROUND ERROR]:', err.message);
      }
    })();

  } catch (error: any) {
    console.error('[WEBHOOK Fatal Error]:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
