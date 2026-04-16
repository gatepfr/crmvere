import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { normalizeEvolution } from './whatsappService';
import { processDemand } from './aiService';
import { EvolutionService } from './evolutionService';
import { normalizePhone } from '../utils/phoneUtils';

/**
 * Filtro para padronizar nomes brasileiros (João da Silva)
 */
const formatName = (name: string) => {
  if (!name) return '';
  const prepositions = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return name
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      if (prepositions.includes(word) && index !== 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

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
      console.log(`[ORCHESTRATOR] Criando munícipe: ${normalized.name}`);
      const [newMunicipe] = await db.insert(municipes).values({ 
        tenantId, 
        name: formatName(normalized.name || 'Cidadão'), 
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

    // 5. Verifica se a demanda já está aguardando retorno humano
    if (existingDemanda?.precisaRetorno) {
      console.log(`[ORCHESTRATOR] Demanda de ${municipe.name} já aguarda retorno humano. Ignorando resposta da IA.`);
      return { status: 'waiting_human' };
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

    // 8. Fluxo de Envio de WhatsApp
    if (tenant.whatsappInstanceId) {
      const evoUrl = 'http://evolution_api:8080';
      const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
      const evolution = new EvolutionService(evoUrl, evoToken);

      // Resposta para o Munícipe
      if (aiResult?.resposta_usuario) {
        await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario);
      }

      // 9. ALERTA PARA A EQUIPE (Se a IA marcou precisa_retorno)
      if (aiResult?.precisa_retorno && tenant.whatsappNotificationNumber) {
        console.log(`[ORCHESTRATOR] 🚨 Alertando equipe no número ${tenant.whatsappNotificationNumber}`);
        
        const cleanSummary = aiResult.resumo_ia?.replace(/\*\*/g, '').replace(/\*/g, '') || 'Sem resumo disponível';
        const alertMsg = `🚨 *ALERTA DE ATENDIMENTO HUMANO*\n\n` +
                        `👤 *Munícipe:* ${municipe.name}\n` +
                        `📱 *Telefone:* ${normalized.from}\n` +
                        `📍 *Bairro:* ${municipe.bairro || 'Não informado'}\n\n` +
                        `📝 *RESUMO:* ${cleanSummary}\n\n` +
                        `⚠️ _A IA solicitou ajuda humana. Acesse o painel para assumir._`;
        
        await evolution.sendMessage(tenant.whatsappInstanceId, tenant.whatsappNotificationNumber, alertMsg)
          .catch(e => console.error('[ORCHESTRATOR ALERT ERROR]:', e.message));
      }
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error(`[ORCHESTRATOR ERROR]`, error.message);
    return { status: 'error', message: error.message };
  }
}
