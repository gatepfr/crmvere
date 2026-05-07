import { db } from '../db';
import { tenants, municipes, atendimentos, documents, systemConfigs, instagramCommentRules } from '../db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { processDemand } from './aiService';
import { InstagramService } from './instagramService';
import { trackAIUsage } from '../middleware/quotaMiddleware';
import { redisService } from './redisService';

const formatName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

async function findOrCreateMunicipeByInstagram(
  tenantId: string,
  senderIgsid: string,
  senderUsername: string,
  autoCreate: boolean
) {
  // Layer 1: find by instagramUserId (fast path for already-linked users)
  const [byId] = await db.select().from(municipes).where(
    and(eq(municipes.instagramUserId, senderIgsid), eq(municipes.tenantId, tenantId))
  );
  if (byId) return byId;

  // Layer 2: find by instagramHandle (avoid duplicate for manually-added users)
  if (senderUsername) {
    const [byHandle] = await db.select().from(municipes).where(
      and(eq(municipes.tenantId, tenantId), ilike(municipes.instagramHandle, senderUsername))
    );
    if (byHandle) {
      const [updated] = await db.update(municipes)
        .set({ instagramUserId: senderIgsid })
        .where(eq(municipes.id, byHandle.id))
        .returning();
      return updated;
    }
  }

  // Layer 3: create new if autoCreate enabled
  if (!autoCreate) return null;

  const igPhone = `ig_${senderIgsid}`;
  const [newM] = await db.insert(municipes).values({
    tenantId,
    name: formatName(senderUsername || 'Instagram'),
    phone: igPhone,
    instagramUserId: senderIgsid,
    instagramHandle: senderUsername || null,
  }).onConflictDoNothing().returning();

  if (!newM) {
    const [existing] = await db.select().from(municipes).where(
      and(eq(municipes.phone, igPhone), eq(municipes.tenantId, tenantId))
    );
    return existing;
  }
  return newM;
}

export async function orchestrateInstagramDM(payload: any, tenantId: string) {
  try {
    const messaging = payload?.entry?.[0]?.messaging?.[0];
    if (!messaging?.message?.text) return { status: 'ignored' };

    const senderIgsid: string = messaging.sender.id;
    const messageText: string = messaging.message.text;
    const senderUsername: string = messaging.sender?.username || '';

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken) return { status: 'no_instagram_config' };

    const autoCreate = tenant.instagramAutoCreateMunicipe !== false;
    const municipe = await findOrCreateMunicipeByInstagram(tenantId, senderIgsid, senderUsername, autoCreate);
    if (!municipe) return { status: 'not_registered' };

    // Register opt-in via DM on first contact
    if (!municipe.instagramOptinSource) {
      await db.update(municipes)
        .set({ instagramOptinSource: 'dm', instagramOptinAt: new Date() })
        .where(eq(municipes.id, municipe.id));
    }

    const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
    const todayStart = new Date(`${todayStr}T00:00:00-03:00`);

    let [existingAtendimento] = await db.select().from(atendimentos).where(and(
      eq(atendimentos.municipeId, municipe.id),
      eq(atendimentos.tenantId, tenantId),
      sql`${atendimentos.createdAt} >= ${todayStart}`
    )).orderBy(desc(atendimentos.createdAt)).limit(1);

    const currentHistory = existingAtendimento?.resumoIa || '';
    const updatedHistory = `${currentHistory}\nCidadão (Instagram): ${messageText}`.trim();

    if (existingAtendimento) {
      await db.update(atendimentos)
        .set({ resumoIa: updatedHistory, updatedAt: new Date() })
        .where(eq(atendimentos.id, existingAtendimento.id));
    } else {
      const [newA] = await db.insert(atendimentos).values({
        tenantId, municipeId: municipe.id, resumoIa: updatedHistory
      }).returning();
      existingAtendimento = newA;
    }

    if (!tenant.instagramDmAiEnabled) {
      return { status: 'saved_no_ai' };
    }

    // Standby 30min for human agent
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isHumanActive = existingAtendimento?.lastHumanInteractionAt &&
      new Date(existingAtendimento.lastHumanInteractionAt) > thirtyMinutesAgo;
    if (isHumanActive) return { status: 'waiting_human' };

    const today = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
    const currentUsage = await redisService.getUsage(tenantId, today);
    if (currentUsage >= (tenant.dailyTokenLimit || 50000)) return { status: 'quota_exceeded' };

    const [globalConfig] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, 'default'));
    const apiKey = tenant.aiApiKey || globalConfig?.aiApiKey;
    if (!apiKey) return { status: 'no_ai_key' };

    const tenantDocs = await db.select().from(documents).where(eq(documents.tenantId, tenantId));
    const knowledge = tenantDocs.map(d => d.textContent).join('\n\n');

    const resultIA = await processDemand(messageText, {
      provider: (tenant.aiProvider || globalConfig?.aiProvider || 'gemini') as any,
      apiKey,
      model: tenant.aiModel || globalConfig?.aiModel || 'gemini-1.5-flash',
      aiBaseUrl: tenant.aiBaseUrl || globalConfig?.aiBaseUrl,
      systemPrompt: tenant.systemPrompt || '',
    }, updatedHistory, knowledge);

    const aiRes = resultIA.data;
    const finalHistory = `${updatedHistory}\nAI: ${aiRes.resposta_usuario}`;

    await trackAIUsage(tenantId, resultIA.usage.total_tokens);

    await db.update(atendimentos).set({
      resumoIa: finalHistory,
      categoria: aiRes.categoria,
      prioridade: aiRes.prioridade,
      precisaRetorno: aiRes.precisa_retorno,
      updatedAt: new Date(),
      ...(aiRes.precisa_retorno ? { lastHumanInteractionAt: new Date() } : {}),
    }).where(eq(atendimentos.id, existingAtendimento.id));

    if (aiRes.resposta_usuario) {
      const igService = new InstagramService(tenant.instagramAccessToken);

      // Use quick replies if configured
      let defaultQRs: { title: string; payload: string }[] = [];
      try { defaultQRs = JSON.parse(tenant.instagramDefaultQuickReplies || '[]'); } catch { }

      if (defaultQRs.length > 0) {
        await igService.sendDMWithQuickReplies(senderIgsid, aiRes.resposta_usuario, defaultQRs);
      } else {
        await igService.sendDM(senderIgsid, aiRes.resposta_usuario);
      }
    }

    return { status: 'success' };
  } catch (e: any) {
    console.error('[INSTAGRAM DM ERROR]', e.message);
    return { status: 'error' };
  }
}

export async function orchestrateInstagramComment(payload: any, tenantId: string) {
  try {
    const change = payload?.entry?.[0]?.changes?.[0];
    if (change?.field !== 'comments') return { status: 'ignored' };

    const commentData = change.value;
    const commentId: string = commentData.id;
    const commentText: string = commentData.text || '';
    const mediaId: string = commentData.media?.id || '';
    const commenterIgsid: string = commentData.from?.id || '';

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken || !tenant?.instagramBotEnabled) return { status: 'bot_disabled' };

    const igService = new InstagramService(tenant.instagramAccessToken);
    const textLower = commentText.toLowerCase();

    // Layer 1: per-post rules (higher priority)
    const postRules = await db.select().from(instagramCommentRules).where(
      and(eq(instagramCommentRules.tenantId, tenantId), eq(instagramCommentRules.mediaId, mediaId))
    );

    for (const rule of postRules) {
      let ruleKeywords: string[] = [];
      try { ruleKeywords = JSON.parse(rule.keywords); } catch { ruleKeywords = [rule.keywords]; }

      if (ruleKeywords.some(kw => textLower.includes(kw.toLowerCase()))) {
        await igService.replyToComment(commentId, rule.replyMessage);
        if (commenterIgsid) {
          await igService.sendDM(commenterIgsid, rule.replyMessage).catch(() => {});
        }
        return { status: 'replied_post_rule' };
      }
    }

    // Layer 2: global tenant keywords
    if (!tenant.instagramCommentKeywords) return { status: 'no_keywords' };

    let globalKeywords: string[] = [];
    try { globalKeywords = JSON.parse(tenant.instagramCommentKeywords); } catch { globalKeywords = [tenant.instagramCommentKeywords]; }

    const matchedGlobal = globalKeywords.some(kw => textLower.includes(kw.toLowerCase()));
    if (!matchedGlobal) return { status: 'no_keyword_match' };

    const replyMessage = tenant.instagramCommentReply || 'Obrigado pelo seu comentário! Em breve entraremos em contato.';
    await igService.replyToComment(commentId, replyMessage);
    if (commenterIgsid) {
      await igService.sendDM(commenterIgsid, replyMessage).catch(() => {});
    }

    return { status: 'replied_global' };
  } catch (e: any) {
    console.error('[INSTAGRAM COMMENT ERROR]', e.message);
    return { status: 'error' };
  }
}

export async function orchestrateInstagramStoryInteraction(payload: any, tenantId: string) {
  try {
    const messaging = payload?.entry?.[0]?.messaging?.[0];
    if (!messaging) return { status: 'ignored' };

    const isStoryMention = messaging.message?.attachments?.some(
      (a: any) => a.type === 'story_mention'
    );
    const isStoryReply = !!messaging.message?.reply_to?.story;

    if (!isStoryMention && !isStoryReply) return { status: 'not_story' };

    const senderIgsid: string = messaging.sender.id;
    const senderUsername: string = messaging.sender?.username || '';
    const interactionType = isStoryMention ? 'story_mention' : 'story_reply';

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken || !tenant?.instagramBotEnabled) return { status: 'bot_disabled' };

    const autoCreate = tenant.instagramAutoCreateMunicipe !== false;
    const municipe = await findOrCreateMunicipeByInstagram(tenantId, senderIgsid, senderUsername, autoCreate);
    if (!municipe) return { status: 'not_registered' };

    await db.update(municipes)
      .set({ instagramOptinSource: interactionType, instagramOptinAt: new Date() })
      .where(eq(municipes.id, municipe.id));

    const welcomeMsg = isStoryMention
      ? (tenant.instagramStoryMentionReply || 'Oi! Vi que você nos mencionou nos Stories. Como posso ajudar?')
      : (tenant.instagramStoryReply || 'Oi! Obrigado por responder nosso Story. Como posso ajudar?');

    const igService = new InstagramService(tenant.instagramAccessToken);
    await igService.sendDM(senderIgsid, welcomeMsg);

    return { status: 'story_dm_sent', type: interactionType };
  } catch (e: any) {
    console.error('[INSTAGRAM STORY ERROR]', e.message);
    return { status: 'error' };
  }
}
