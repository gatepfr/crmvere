import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs, atendimentos } from '../db/schema';
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
    
    // 1. Ignora se não for mensagem real de cidadão
    if (!normalized || normalized.fromMe || normalized.isGroup) return { status: 'ignored' };
    if (!normalized.text || normalized.text.trim() === '') return { status: 'no_text' };

    console.log(`[ORCHESTRATOR] Mensagem de ${normalized.from} para tenant ${tenantId}`);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return { status: 'tenant_not_found' };

    // 2. Busca ou Cria Munícipe
    const cleanPhone = normalized.from;
    let [municipe] = await db.select().from(municipes).where(and(eq(municipes.phone, cleanPhone), eq(municipes.tenantId, tenantId)));

    if (!municipe) {
      const [newMunicipe] = await db.insert(municipes).values({ 
        tenantId, 
        name: formatName(normalized.name || 'Cidadão'), 
        phone: cleanPhone 
      }).returning();
      municipe = newMunicipe;
    }

    // 3. Busca Atendimento de HOJE (Para agrupar mensagens do mesmo dia na mesma linha)
    let [existingAtendimento] = await db.select()
      .from(atendimentos)
      .where(and(
        eq(atendimentos.municipeId, municipe.id), 
        eq(atendimentos.tenantId, tenantId),
        sql`date_trunc('day', ${atendimentos.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`
      ))
      .orderBy(desc(atendimentos.updatedAt))
      .limit(1);

    // 4. Verifica Silêncio da IA (10 minutos após interação HUMANA)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const isHumanActive = existingAtendimento?.lastHumanInteractionAt && new Date(existingAtendimento.lastHumanInteractionAt) > tenMinutesAgo;

    const currentHistory = existingAtendimento ? existingAtendimento.resumoIa : '';
    const updatedHistoryWithCitizen = `${currentHistory}\nCidadão: ${normalized.text}`.trim();

    // 5. Salva Mensagem no Painel Imediatamente (Para garantir atualização visual)
    if (existingAtendimento) {
      await db.update(atendimentos).set({
        resumoIa: updatedHistoryWithCitizen,
        updatedAt: new Date(),
      }).where(eq(atendimentos.id, existingAtendimento.id));
    } else {
      const [newAtendimento] = await db.insert(atendimentos).values({
        tenantId,
        municipeId: municipe.id,
        resumoIa: updatedHistoryWithCitizen,
        status: 'nova',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      existingAtendimento = newAtendimento;
    }

    // Se humano respondeu nos últimos 10min, a IA fica em silêncio e o fluxo termina aqui
    if (isHumanActive) {
      console.log(`[ORCHESTRATOR] IA em standby para ${municipe.name} (Humano ativo)`);
      return { status: 'waiting_human' };
    }

    // 6. Configurações da IA
    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    const knowledgeBase = tenantDocs.map(doc => `--- ${doc.fileName} ---\n${doc.textContent}`).join('\n\n');

    const configList = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const globalConfig = configList[0];
    const provider = tenant?.aiProvider || globalConfig?.aiProvider || 'gemini';
    const apiKey = tenant?.aiApiKey || globalConfig?.aiApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) return { status: 'no_ai_key' };

    // 7. Chamada da IA para Analisar e Gerar Resposta
    console.log(`[ORCHESTRATOR] Solicitando IA para ${municipe.name}`);
    const resultIA = await processDemand(normalized.text, {
      provider: provider as any,
      apiKey: apiKey,
      model: tenant?.aiModel || globalConfig?.aiModel || 'gemini-1.5-flash',
      aiBaseUrl: tenant?.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant?.systemPrompt || ''
    }, updatedHistoryWithCitizen, knowledgeBase);

    const aiResult = resultIA.data;

    // 8. Atualiza Painel com Resposta da IA e Triagem (Categoria/Prioridade)
    const finalHistory = `${updatedHistoryWithCitizen}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;
    await db.update(atendimentos).set({
      resumoIa: finalHistory,
      categoria: aiResult?.categoria || sql`${atendimentos.categoria}`,
      prioridade: aiResult?.prioridade || sql`${atendimentos.prioridade}`,
      precisaRetorno: aiResult?.precisa_retorno !== undefined ? aiResult.precisa_retorno : sql`${atendimentos.precisaRetorno}`,
      updatedAt: new Date(),
    }).where(eq(atendimentos.id, existingAtendimento.id));

    // 9. Envio Final para o WhatsApp
    if (tenant.whatsappInstanceId && aiResult?.resposta_usuario) {
      const evoUrl = process.env.EVOLUTION_URL || 'http://evolution_api:8080';
      const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
      const evolution = new EvolutionService(evoUrl, evoToken);
      
      const targetJid = normalized.jid || `${normalized.from}@s.whatsapp.net`;
      await evolution.sendMessage(tenant.whatsappInstanceId, targetJid, aiResult.resposta_usuario);
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error(`[ORCHESTRATOR ERROR]`, error.message);
    return { status: 'error', message: error.message };
  }
}
