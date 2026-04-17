import { db } from '../db';
import { tenants, municipes, demandas, documents, systemConfigs, atendimentos } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { normalizeEvolution } from './whatsappService';
import { processDemand } from './aiService';
import { EvolutionService } from './evolutionService';

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

    // 2. Busca Atendimento de HOJE (Lógica antiga de data)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let [existingAtendimento] = await db.select().from(atendimentos).where(and(
      eq(atendimentos.municipeId, municipe.id),
      eq(atendimentos.tenantId, tenantId),
      sql`${atendimentos.createdAt} >= ${todayStart}`
    )).orderBy(desc(atendimentos.createdAt)).limit(1);

    // 3. Standby Humano (Opcional, 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const isHumanActive = existingAtendimento?.lastHumanInteractionAt && new Date(existingAtendimento.lastHumanInteractionAt) > tenMinutesAgo;

    const currentHistory = existingAtendimento?.resumoIa || '';
    const updatedHistory = `${currentHistory}\nCidadão: ${normalized.text}`.trim();

    // 4. Salva no Painel
    if (existingAtendimento) {
      await db.update(atendimentos).set({ resumoIa: updatedHistory, updatedAt: new Date() }).where(eq(atendimentos.id, existingAtendimento.id));
    } else {
      const [newA] = await db.insert(atendimentos).values({ tenantId, municipeId: municipe.id, resumoIa: updatedHistory }).returning();
      existingAtendimento = newA;
    }

    if (isHumanActive) return { status: 'waiting_human' };

    // 5. Chamada da IA
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

    // 6. Atualiza com resposta da IA
    await db.update(atendimentos).set({
      resumoIa: finalHistory,
      categoria: aiRes.categoria,
      prioridade: aiRes.prioridade,
      precisaRetorno: aiRes.precisa_retorno,
      updatedAt: new Date()
    }).where(eq(atendimentos.id, existingAtendimento.id));

    // 7. Envia WhatsApp
    if (aiRes.resposta_usuario && tenant.whatsappInstanceId) {
      const evoUrl = process.env.EVOLUTION_URL || 'http://evolution_api:8080';
      const evoToken = tenant.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
      const evolution = new EvolutionService(evoUrl, evoToken);
      await evolution.sendMessage(tenant.whatsappInstanceId, normalized.jid, aiRes.resposta_usuario);
    }

    return { status: 'success' };
  } catch (e: any) {
    console.error('[ORCHESTRATOR ERROR]', e.message);
    return { status: 'error' };
  }
}
