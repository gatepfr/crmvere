import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { normalizeEvolution } from './whatsappService';
import { processDemand } from './aiService';
import { EvolutionService } from './evolutionService';
import { normalizePhone } from '../utils/phoneUtils';

/**
 * Serviço responsável por orquestrar o fluxo de mensagens vindas do WhatsApp
 * desde a recepção do webhook até a resposta final da IA.
 */
export async function orchestrateWebhook(payload: any, tenantId: string) {
  console.log(`[ORCHESTRATOR] Iniciando fluxo para tenant ${tenantId}`);

  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    // Filtros de Ignorar (Nossa mensagem, grupos ou texto vazio)
    if (normalized.fromMe || normalized.isGroup) return { status: 'ignored' };
    if (!normalized.text || normalized.text.trim() === '') return { status: 'no_text' };

    console.log(`[ORCHESTRATOR] Mensagem de ${normalized.from}: "${normalized.text.substring(0, 30)}..."`);

    // 1. Buscar configurações do Gabinete (Tenant)
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) {
      console.error(`[ORCHESTRATOR ERROR] Tenant ${tenantId} não encontrado.`);
      return { status: 'tenant_not_found' };
    }

    // 2. Identificar ou Criar o Munícipe
    const cleanPhone = normalized.from.replace(/\D/g, '');
    let [municipe] = await db.select().from(municipes).where(
      and(eq(municipes.phone, cleanPhone), eq(municipes.tenantId, tenantId))
    );

    if (!municipe) {
      console.log(`[ORCHESTRATOR] Novo munícipe detectado: ${normalized.name || 'Cidadão'}`);
      const [newMunicipe] = await db.insert(municipes).values({ 
        tenantId, 
        name: normalized.name || 'Cidadão', 
        phone: cleanPhone 
      }).returning();
      municipe = newMunicipe;
    }

    // 3. Buscar Demanda Ativa (Criada hoje e aberta)
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

    // 4. Verificar Intervenção Humana (Trava de 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const history = existingDemanda?.resumoIa || '';
    const lastGabineteIndex = history.lastIndexOf('Gabinete:');
    const lastAIIndex = history.lastIndexOf('AI:');
    const isHumanLastSpeaker = lastGabineteIndex > lastAIIndex;
    const wasRecentlyUpdatedByHuman = existingDemanda && existingDemanda.updatedAt && existingDemanda.updatedAt > tenMinutesAgo;

    if (isHumanLastSpeaker && wasRecentlyUpdatedByHuman) {
      console.log(`[ORCHESTRATOR] IA Silenciada: Humano respondeu recentemente.`);
      return { status: 'human_active' };
    }

    // 5. Preparar Base de Conhecimento
    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    let knowledgeBaseContent = tenantDocs
      .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
      .join('\n\n');

    // 6. Chamar a Inteligência Artificial
    const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const provider = tenant?.aiProvider || globalConfig?.aiProvider || 'gemini';
    const apiKey = tenant?.aiApiKey || globalConfig?.aiApiKey || process.env.GEMINI_API_KEY;
    const model = tenant?.aiModel || globalConfig?.aiModel || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o');

    if (!apiKey) {
      console.error(`[ORCHESTRATOR ERROR] Sem chave de IA.`);
      return { status: 'no_ai_key' };
    }

    let promptContext = history ? `${history}\nCidadão: ${normalized.text}` : `Cidadão: ${normalized.text}`;
    
    console.log(`[ORCHESTRATOR] Solicitando resposta da IA...`);
    const resultIA = await processDemand(promptContext, {
      provider: provider as any,
      apiKey: apiKey,
      model: model,
      aiBaseUrl: tenant?.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant?.systemPrompt || ''
    }, undefined, knowledgeBaseContent);

    const aiResult = resultIA.data;
    const updatedHistory = `${promptContext}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;

    // 7. Salvar ou Atualizar a Demanda no Banco
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

    // 8. Enviar Resposta via WhatsApp (Evolution API)
    if (aiResult?.resposta_usuario && tenant.whatsappInstanceId) {
      // Usamos o endereço interno do docker para enviar
      const evoUrl = 'http://evolution_api:8080';
      const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';

      const evolution = new EvolutionService(evoUrl, evoToken);
      await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario);
      console.log(`[ORCHESTRATOR] ✅ Resposta da IA enviada via WhatsApp para ${normalized.from}.`);
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error(`[ORCHESTRATOR FATAL ERROR]`, error.message);
    return { status: 'error', message: error.message };
  }
}
