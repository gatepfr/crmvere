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
    
    if (normalized.fromMe || normalized.isGroup) return { status: 'ignored' };
    // Ajuste: Removemos o bloqueio de "no_text" para permitir que mídias ([Imagem], etc) apareçam no painel
    const messageContent = normalized.text || '[Mensagem sem texto]';

    console.log(`[ORCHESTRATOR] Mensagem de ${normalized.from} para tenant ${tenantId}`);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return { status: 'tenant_not_found' };

    const cleanPhone = normalizePhone(normalized.from);
    console.log(`[ORCHESTRATOR] Buscando munícipe para o telefone: ${cleanPhone}`);
    
    let municipe;
    try {
      // Usamos upsert para o munícipe para garantir que ele exista sem disparar erro de duplicidade
      const [upsertedMunicipe] = await db.insert(municipes).values({ 
        tenantId, 
        name: formatName(normalized.name || 'Cidadão'), 
        phone: cleanPhone 
      }).onConflictDoUpdate({
        target: [municipes.tenantId, municipes.phone],
        set: { name: formatName(normalized.name || 'Cidadão') } // Atualiza o nome se mudar
      }).returning();
      
      municipe = upsertedMunicipe;
    } catch (municipeError: any) {
      console.error(`[ORCHESTRATOR ERROR] Falha ao gerenciar munícipe:`, municipeError.message);
      // Fallback: tenta buscar se o insert falhou por algum outro motivo
      const [existing] = await db.select().from(municipes).where(and(eq(municipes.phone, cleanPhone), eq(municipes.tenantId, tenantId)));
      municipe = existing;
    }

    if (!municipe) {
      console.error(`[ORCHESTRATOR FATAL] Não foi possível encontrar ou criar o munícipe.`);
      return { status: 'municipe_error' };
    }

    // 5. Busca Atendimento de Hoje (Fuso Brasília)
    // Usamos SQL para comparar a data e garantir que não haja erro de fuso entre Node e Postgres
    let [existingAtendimento] = await db.select()
      .from(atendimentos)
      .where(and(
        eq(atendimentos.municipeId, municipe.id), 
        eq(atendimentos.tenantId, tenantId),
        sql`date_trunc('day', ${atendimentos.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`
      ))
      .orderBy(desc(atendimentos.updatedAt))
      .limit(1);

    // 6. Verifica Standby (Intervenção Humana nos últimos 10 min)
    // Se houve interação humana (lastHumanInteractionAt) há menos de 10 min, a IA silencia.
    let isHumanActive = false;
    if (existingAtendimento?.lastHumanInteractionAt) {
      const lastInteraction = new Date(existingAtendimento.lastHumanInteractionAt).getTime();
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      isHumanActive = lastInteraction > tenMinutesAgo;
    }

    // 7. SEMPRE atualiza o histórico com a mensagem do cidadão e sobe para o topo (updatedAt)
    const historyWithCitizen = existingAtendimento 
      ? `${existingAtendimento.resumoIa}\nCidadão: ${messageContent}`
      : `Cidadão: ${messageContent}`;

    try {
      if (existingAtendimento) {
        await db.update(atendimentos).set({
          resumoIa: historyWithCitizen,
          updatedAt: new Date(),
        }).where(eq(atendimentos.id, existingAtendimento.id));
      } else {
        console.log(`[ORCHESTRATOR] Criando registro para ${municipe.name}`);
        const [newAtendimento] = await db.insert(atendimentos).values({
          tenantId,
          municipeId: municipe.id,
          resumoIa: historyWithCitizen,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        existingAtendimento = newAtendimento;
      }
    } catch (dbError: any) {
      console.error(`[ORCHESTRATOR DB ERROR] Erro ao salvar:`, dbError.message);
      // Fallback para constraint antiga
      const [lastOne] = await db.select().from(atendimentos)
        .where(and(eq(atendimentos.municipeId, municipe.id), eq(atendimentos.tenantId, tenantId)))
        .orderBy(desc(atendimentos.updatedAt)).limit(1);
      
      if (lastOne) {
        await db.update(atendimentos).set({
          resumoIa: `${lastOne.resumoIa}\n[NEW] Cidadão: ${messageContent}`,
          updatedAt: new Date()
        }).where(eq(atendimentos.id, lastOne.id));
        existingAtendimento = lastOne;
      }
    }

    if (isHumanActive) {
      console.log(`[ORCHESTRATOR] Standby humano ativo para ${municipe.name}. Apenas registrei no painel.`);
      return { status: 'waiting_human' };
    }

    // 8. Busca Configurações de IA
    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    let knowledgeBaseContent = tenantDocs
      .map(doc => `--- DOCUMENTO: ${doc.fileName} ---\n${doc.textContent}`)
      .join('\n\n');

    const configList = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const globalConfig = configList[0];
    
    const provider = tenant?.aiProvider || globalConfig?.aiProvider || 'gemini';
    const apiKey = tenant?.aiApiKey || globalConfig?.aiApiKey || process.env.GEMINI_API_KEY;
    const model = tenant?.aiModel || globalConfig?.aiModel || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o');

    if (!apiKey) return { status: 'no_ai_key' };

    // 9. Chamada da IA
    // AJUSTE: Passamos apenas o texto da última mensagem para análise, mantendo o histórico anterior como contexto se necessário
    console.log(`[ORCHESTRATOR] Chamando IA (${provider})...`);
    const resultIA = await processDemand(messageContent, {
      provider: provider as any,
      apiKey: apiKey,
      model: model,
      aiBaseUrl: tenant?.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant?.systemPrompt || ''
    }, historyWithCitizen, knowledgeBaseContent);

    const aiResult = resultIA.data;
    console.log(`[ORCHESTRATOR] IA respondeu para ${municipe.name}`);

    // 10. Atualiza com a resposta da IA e Triagem
    const finalHistory = `${historyWithCitizen}${aiResult?.resposta_usuario ? `\nAI: ${aiResult.resposta_usuario}` : ''}`;

    try {
      await db.update(atendimentos).set({
        resumoIa: finalHistory,
        categoria: aiResult?.categoria || sql`${atendimentos.categoria}`,
        prioridade: aiResult?.prioridade || sql`${atendimentos.prioridade}`,
        precisaRetorno: aiResult?.precisa_retorno !== undefined ? aiResult.precisa_retorno : sql`${atendimentos.precisaRetorno}`,
        updatedAt: new Date(),
      }).where(eq(atendimentos.id, existingAtendimento.id));
    } catch (dbError: any) {
      console.error(`[ORCHESTRATOR DB ERROR] Erro ao salvar resposta da IA:`, dbError.message);
    }

    // 8. Fluxo de Envio de WhatsApp
    if (tenant.whatsappInstanceId) {
      const evoUrl = process.env.EVOLUTION_URL || 'http://evolution_api:8080';
      const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
      const evolution = new EvolutionService(evoUrl, evoToken);

      // Fallback de Segurança para o JID
      const targetJid = normalized.jid || `${normalized.from}@s.whatsapp.net`;

      if (!targetJid || targetJid.startsWith('@')) {
        console.error(`[ORCHESTRATOR FATAL] Destinatário inválido para envio: "${targetJid}"`);
        return { status: 'invalid_recipient' };
      }

      console.log(`[ORCHESTRATOR] Enviando WhatsApp para ${targetJid} via ${evoUrl}`);

      // Resposta para o Munícipe
      if (aiResult?.resposta_usuario) {
        await evolution.sendMessage(tenant.whatsappInstanceId, targetJid, aiResult.resposta_usuario);
        console.log(`[ORCHESTRATOR] Resposta enviada ao munícipe.`);
      }

      // 9. ALERTA PARA A EQUIPE (Se a IA marcou precisa_retorno)
      if (aiResult?.precisa_retorno && tenant.whatsappNotificationNumber) {
        const teamJid = tenant.whatsappNotificationNumber.includes('@') 
          ? tenant.whatsappNotificationNumber 
          : `${tenant.whatsappNotificationNumber.replace(/\D/g, '')}@s.whatsapp.net`;

        console.log(`[ORCHESTRATOR] 🚨 Alertando equipe no número ${teamJid}`);
        
        const cleanSummary = aiResult.resumo_ia?.replace(/\*\*/g, '').replace(/\*/g, '') || 'Sem resumo disponível';
        const alertMsg = `🚨 *ALERTA DE ATENDIMENTO HUMANO*\n\n` +
                        `👤 *Munícipe:* ${municipe.name}\n` +
                        `📱 *Telefone:* ${normalized.from}\n` +
                        `📍 *Bairro:* ${municipe.bairro || 'Não informado'}\n\n` +
                        `📝 *RESUMO:* ${cleanSummary}\n\n` +
                        `⚠️ _A IA solicitou ajuda humana. Acesse o painel para assumir._`;
        
        await evolution.sendMessage(tenant.whatsappInstanceId, teamJid, alertMsg)
          .catch(e => console.error('[ORCHESTRATOR ALERT ERROR]:', e.message));
      }
    }

    return { status: 'success' };
  } catch (error: any) {
    console.error(`[ORCHESTRATOR ERROR]`, error.message);
    return { status: 'error', message: error.message };
  }
}
