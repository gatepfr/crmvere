import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs, atendimentos } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { normalizeEvolution } from './whatsappService';
import { processDemand } from './aiService';
import { EvolutionService } from './evolutionService';
import { trackAIUsage } from '../middleware/quotaMiddleware';
import { redisService } from './redisService';

const formatName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export async function orchestrateWebhook(payload: any, tenantId: string) {
  try {
    const normalized = normalizeEvolution(payload, tenantId);
    if (!normalized) return { status: 'ignored' };

    console.log(`[ORCHESTRATOR] Mensagem de ${normalized.from} para ${tenantId}`);

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return { status: 'tenant_not_found' };

    // 1. Busca ou Cria Munícipe
    let [municipe] = await db.select().from(municipes).where(and(eq(municipes.phone, normalized.from), eq(municipes.tenantId, tenantId)));
    if (!municipe) {
      const [newM] = await db.insert(municipes).values({ tenantId, name: formatName(normalized.name), phone: normalized.from }).returning();
      municipe = newM;
    }

    // 2. Busca Atendimento de HOJE
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let [existingAtendimento] = await db.select().from(atendimentos).where(and(
      eq(atendimentos.municipeId, municipe.id),
      eq(atendimentos.tenantId, tenantId),
      sql`${atendimentos.createdAt} >= ${todayStart}`
    )).orderBy(desc(atendimentos.createdAt)).limit(1);

    const currentHistory = existingAtendimento?.resumoIa || '';
    const updatedHistory = `${currentHistory}\nCidadão: ${normalized.text}`.trim();

    // 3. Salva no Painel
    if (existingAtendimento) {
      await db.update(atendimentos).set({ resumoIa: updatedHistory, updatedAt: new Date() }).where(eq(atendimentos.id, existingAtendimento.id));
    } else {
      const [newA] = await db.insert(atendimentos).values({ tenantId, municipeId: municipe.id, resumoIa: updatedHistory }).returning();
      existingAtendimento = newA;
    }

    // 4. Standby Humano (30 min)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isHumanActive = existingAtendimento?.lastHumanInteractionAt && new Date(existingAtendimento.lastHumanInteractionAt) > thirtyMinutesAgo;
    if (isHumanActive) return { status: 'waiting_human' };

    // 5. Verificação de Quota antes de chamar a IA
    const today = new Date().toISOString().split('T')[0];
    const currentUsage = await redisService.getUsage(tenantId, today);
    const dailyLimit = tenant.dailyTokenLimit || 50000;
    if (currentUsage >= dailyLimit) {
      console.log(`[ORCHESTRATOR] Tenant ${tenantId} atingiu limite diário de tokens (${currentUsage}/${dailyLimit})`);
      return { status: 'quota_exceeded' };
    }

    // 6. Chamada da IA
    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    const knowledge = tenantDocs.map(d => d.textContent).join('\n\n');
    const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));

    const apiKey = tenant.aiApiKey || globalConfig?.aiApiKey;
    if (!apiKey) return { status: 'no_ai_key' };

    const resultIA = await processDemand(normalized.text, {
      provider: (tenant.aiProvider || globalConfig?.aiProvider || 'gemini') as any,
      apiKey: apiKey,
      model: tenant.aiModel || globalConfig?.aiModel || 'gemini-1.5-flash',
      aiBaseUrl: tenant.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant.systemPrompt || ''
    }, updatedHistory, knowledge);

    const aiRes = resultIA.data;
    const finalHistory = `${updatedHistory}\nAI: ${aiRes.resposta_usuario}`;

    // Contabiliza tokens usados
    await trackAIUsage(tenantId, resultIA.usage.total_tokens);
    console.log(`[ORCHESTRATOR] Tokens usados: ${resultIA.usage.total_tokens} | Tenant: ${tenantId}`);

    // 7. Atualiza com resposta da IA
    await db.update(atendimentos).set({
      resumoIa: finalHistory,
      categoria: aiRes.categoria,
      prioridade: aiRes.prioridade,
      precisaRetorno: aiRes.precisa_retorno,
      updatedAt: new Date()
    }).where(eq(atendimentos.id, existingAtendimento.id));

    // 8. Configuração da Evolution API (Usa URL do banco se disponível)
    const evoUrl = tenant.evolutionApiUrl || process.env.EVOLUTION_URL || 'http://evolution_api:8080';
    const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
    const evolution = new EvolutionService(evoUrl, evoToken);

    // 9. Envia WhatsApp para o Cidadão
    if (aiRes.resposta_usuario && tenant.whatsappInstanceId) {
      await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiRes.resposta_usuario);
    }

    // 10. Notifica a Equipe (ALERTA DE ATENÇÃO)
    if (aiRes.precisa_retorno && tenant.whatsappNotificationNumber && tenant.whatsappInstanceId) {
      const cleanTeamNumber = tenant.whatsappNotificationNumber.replace(/\D/g, '');
      const teamJid = `${cleanTeamNumber.startsWith('55') ? cleanTeamNumber : '55' + cleanTeamNumber}@s.whatsapp.net`;
      
      const teamMessage = `🚨 *ATENÇÃO NECESSÁRIA*\n\n👤 *${municipe.name}*\n📱 ${municipe.phone}\n\n📋 *Resumo:* ${aiRes.resumo_ia || 'Nova demanda identificada'}\n\n💬 *Última mensagem:*\n"${normalized.text}"\n\n🏷️ ${(aiRes.categoria || 'OUTRO').toUpperCase()} · Prioridade ${(aiRes.prioridade || 'MEDIA').toUpperCase()}\n\n⏳ _A IA está pausada por 30 min. Responda pelo WhatsApp ou pelo painel._`;
      
      await evolution.sendMessage(tenant.whatsappInstanceId, teamJid, teamMessage)
        .catch(err => console.error('[NOTIFICATION ERROR]', err.message));
    }

    return { status: 'success' };
  } catch (e: any) {
    console.error('[ORCHESTRATOR ERROR]', e.message);
    return { status: 'error' };
  }
}
