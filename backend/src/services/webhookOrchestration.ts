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

    // Busca atendimento criado HOJE (Fuso Brasília) para este munícipe
    let [existingAtendimento] = await db.select()
      .from(atendimentos)
      .where(and(
        eq(atendimentos.municipeId, municipe.id), 
        eq(atendimentos.tenantId, tenantId),
        sql`date_trunc('day', ${atendimentos.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`
      ))
      .orderBy(desc(atendimentos.updatedAt))
      .limit(1);

    // 5. Verifica se é Intervenção Humana Recente (Standby de 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const isHumanActive = existingAtendimento && existingAtendimento.updatedAt > tenMinutesAgo;

    // 6. SEMPRE atualiza o histórico com a mensagem do cidadão e sobe para o topo
    const historyWithCitizen = existingAtendimento 
      ? `${existingAtendimento.resumoIa}\nCidadão: ${messageContent}`
      : `Cidadão: ${messageContent}`;

    try {
      if (existingAtendimento) {
        console.log(`[ORCHESTRATOR] Atualizando atendimento de hoje ID: ${existingAtendimento.id}`);
        await db.update(atendimentos).set({
          resumoIa: historyWithCitizen,
          updatedAt: new Date(),
        }).where(eq(atendimentos.id, existingAtendimento.id));
      } else {
        console.log(`[ORCHESTRATOR] Criando NOVO registro de atendimento para ${municipe.name}`);
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
      console.error(`[ORCHESTRATOR DB ERROR] Erro crítico ao salvar atendimento:`, dbError.message);
      if (dbError.message.includes('unique constraint') || dbError.message.includes('atendimento_tenant_municipe_unq')) {
         console.log(`[ORCHESTRATOR] Tentando fallback para update em registro antigo devido a constraint de banco...`);
         const [lastOne] = await db.select().from(atendimentos)
           .where(and(eq(atendimentos.municipeId, municipe.id), eq(atendimentos.tenantId, tenantId)))
           .orderBy(desc(atendimentos.updatedAt)).limit(1);
         
         if (lastOne) {
           await db.update(atendimentos).set({
             resumoIa: `${lastOne.resumoIa}\n[NOVO DIA] Cidadão: ${messageContent}`,
             updatedAt: new Date()
           }).where(eq(atendimentos.id, lastOne.id));
           existingAtendimento = lastOne;
         }
      }
    }

    // 7. Se o humano estiver ativo, paramos por aqui (não chama IA nem responde)
    if (isHumanActive) {
      console.log(`[ORCHESTRATOR] Humano ativo (< 10 min). IA em silêncio, apenas registrou no painel.`);
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
      console.log(`[ORCHESTRATOR] Enviando WhatsApp via ${evoUrl} (Instância: ${tenant.whatsappInstanceId})`);
      const evolution = new EvolutionService(evoUrl, evoToken);

      // Resposta para o Munícipe
      if (aiResult?.resposta_usuario) {
        await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiResult.resposta_usuario);
        console.log(`[ORCHESTRATOR] Resposta enviada ao munícipe.`);
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
