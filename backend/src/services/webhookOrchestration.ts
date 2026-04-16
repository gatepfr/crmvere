import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { normalizeEvolution } from './whatsappService';
import { processDemand } from './aiService';
import { EvolutionService } from './evolutionService';
import { normalizePhone } from '../utils/phoneUtils';

/**
 * Serviço responsável por orquestrar o fluxo de mensagens vindas do WhatsApp
 */
export async function orchestrateWebhook(payload: any, tenantId: string) {
  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    if (normalized.fromMe || normalized.isGroup) return { status: 'ignored' };
    if (!normalized.text || normalized.text.trim() === '') return { status: 'no_text' };

    console.log(`[ORCHESTRATOR] Mensagem de ${normalized.from} para tenant ${tenantId}`);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return { status: 'tenant_not_found' };

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

    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    let knowledgeBaseContent = tenantDocs
      .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
      .join('\n\n');

    const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const provider = tenant?.aiProvider || globalConfig?.aiProvider || 'gemini';
    const apiKey = tenant?.aiApiKey || globalConfig?.aiApiKey || process.env.GEMINI_API_KEY;
    const model = tenant?.aiModel || globalConfig?.aiModel || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o');

    if (!apiKey) return { status: 'no_ai_key' };

    const history = existingDemanda?.resumoIa || '';
    let promptContext = history ? `${history}\nCidadão: ${normalized.text}` : `Cidadão: ${normalized.text}`;
    
    const resultIA = await processDemand(promptContext, {
      provider: provider as any,
      apiKey: apiKey,
      model: model,
      aiBaseUrl: tenant?.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant?.systemPrompt || ''
    }, undefined, knowledgeBaseContent);

    const aiResult = resultIA.data;
    const updatedHistory = `${promptContext}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;

    // SALVAMENTO DA DEMANDA (Corrigido: removido o campo 'bairro' que não pertence a esta tabela)
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
      const evoUrl = 'http://evolution_api:8080';
      const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
      const evolution = new EvolutionService(evoUrl, evoToken);
      await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario);
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error(`[ORCHESTRATOR ERROR]`, error.message);
    return { status: 'error', message: error.message };
  }
}
