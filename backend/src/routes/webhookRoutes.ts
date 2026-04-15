import { Router, Request, Response } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
import { normalizeEvolution } from '../services/whatsappService';
import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs } from '../db/schema';
import { processDemand } from '../services/aiService';
import { EvolutionService } from '../services/evolutionService';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

router.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

router.post(['/evolution/:tenantId', '/evolution/:tenantId/:eventName'], express.json(), async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  const payload = req.body;

  // Log de entrada para diagnóstico
  console.log(`[WEBHOOK] Incoming from tenant ${tenantId} (Event: ${payload?.event || 'unknown'})`);

  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    // 0. RESPONDER IMEDIATAMENTE para evitar duplicidade
    res.status(200).json({ status: 'received' });

    // Filtros de segurança
    if (normalized.fromMe || normalized.isGroup) return;
    if (!normalized.text || normalized.text.trim() === '') return;

    // 1. Processar em background
    (async () => {
      try {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
        if (!tenant) return;

        const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
        let knowledgeBaseContent = tenantDocs
          .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
          .join('\n\n');

        const cleanPhone = normalized.from.replace(/\D/g, '');
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

        const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
        const provider = tenant?.aiProvider || globalConfig?.aiProvider || 'gemini';
        const apiKey = tenant?.aiApiKey || globalConfig?.aiApiKey || process.env.GEMINI_API_KEY;
        const model = tenant?.aiModel || globalConfig?.aiModel || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o');

        if (!apiKey) return;

        let conversationHistory = existingDemanda?.resumoIa || '';
        let promptContext = conversationHistory ? `${conversationHistory}\nCidadão: ${normalized.text}` : `Cidadão: ${normalized.text}`;

        const result = await processDemand(promptContext, {
          provider: provider as any,
          apiKey: apiKey,
          model: model,
          aiBaseUrl: tenant?.aiBaseUrl || globalConfig?.aiBaseUrl,
          systemPrompt: tenant?.systemPrompt || ''
        }, undefined, knowledgeBaseContent);

        const aiResult = result.data;
        const updatedHistory = `${promptContext}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;

        // Salvar com bairro em MAIÚSCULO se a IA identificar o bairro
        const updatedBairro = aiResult?.bairro ? aiResult.bairro.toUpperCase() : existingDemanda?.bairro;

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

        if (aiResult?.resposta_usuario && tenant.whatsappInstanceId) {
          const evoUrl = tenant.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
          const evoToken = tenant.evolutionGlobalToken || process.env.EVOLUTION_API_TOKEN || 'mestre123';

          const evolution = new EvolutionService(evoUrl, evoToken);
          await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario);
          console.log(`[WEBHOOK] ✅ Resposta enviada com sucesso.`);
        }
      } catch (err: any) {
        console.error('[WEBHOOK BACKGROUND ERROR]:', err.message);
      }
    })();

  } catch (error: any) {
    console.error('[WEBHOOK Fatal Error]:', error.message);
    if (!res.headersSent) {
      res.status(200).json({ status: 'error_logged' });
    }
  }
});

export default router;
