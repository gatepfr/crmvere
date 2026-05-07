import { Router, Request, Response } from 'express';
import { db } from '../db';
import { tenants, instagramCommentRules, instagramQuickReplyFlows } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { InstagramService } from '../services/instagramService';

const router = Router();

// Check Meta API connection status
router.get('/status', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramAccessToken) return res.json({ connected: false });

    const igService = new InstagramService(tenant.instagramAccessToken);
    const info = await igService.getAccountInfo();
    return res.json({ connected: true, accountId: info.id, username: info.username });
  } catch {
    return res.json({ connected: false, error: 'Token inválido ou expirado.' });
  }
});

// Save Instagram configuration
router.post('/setup', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const {
    instagramAccessToken, instagramWebhookVerifyToken,
    instagramDmAiEnabled, instagramAutoCreateMunicipe, instagramBotEnabled,
    instagramCommentKeywords, instagramCommentReply,
    instagramStoryMentionReply, instagramStoryReply, instagramDefaultQuickReplies,
  } = req.body;

  try {
    await db.update(tenants)
      .set({
        instagramAccessToken, instagramWebhookVerifyToken,
        instagramDmAiEnabled: instagramDmAiEnabled ?? true,
        instagramAutoCreateMunicipe: instagramAutoCreateMunicipe ?? true,
        instagramBotEnabled: instagramBotEnabled ?? false,
        instagramCommentKeywords,
        instagramCommentReply,
        instagramStoryMentionReply,
        instagramStoryReply,
        instagramDefaultQuickReplies,
      })
      .where(eq(tenants.id, tenantId));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Falha ao salvar configurações do Instagram.' });
  }
});

// List per-post comment rules
router.get('/comment-rules', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const rules = await db.select().from(instagramCommentRules)
    .where(eq(instagramCommentRules.tenantId, tenantId));
  res.json(rules);
});

// Create per-post comment rule
router.post('/comment-rules', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const { mediaId, mediaLabel, keywords, replyMessage } = req.body;
  if (!mediaId || !mediaLabel || !keywords || !replyMessage) {
    return res.status(400).json({ error: 'Campos obrigatórios: mediaId, mediaLabel, keywords, replyMessage' });
  }

  const [rule] = await db.insert(instagramCommentRules)
    .values({ tenantId, mediaId, mediaLabel, keywords: JSON.stringify(keywords), replyMessage })
    .returning();
  res.status(201).json(rule);
});

// Delete per-post comment rule
router.delete('/comment-rules/:id', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  await db.delete(instagramCommentRules).where(
    and(eq(instagramCommentRules.id, id), eq(instagramCommentRules.tenantId, tenantId))
  );
  res.json({ success: true });
});

// List quick reply flows
router.get('/quick-reply-flows', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const flows = await db.select().from(instagramQuickReplyFlows)
    .where(eq(instagramQuickReplyFlows.tenantId, tenantId));
  res.json(flows);
});

// Create quick reply flow
router.post('/quick-reply-flows', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const { triggerPayload, responseMessage, nextQuickReplies } = req.body;
  if (!triggerPayload || !responseMessage) {
    return res.status(400).json({ error: 'Campos obrigatórios: triggerPayload, responseMessage' });
  }

  const [flow] = await db.insert(instagramQuickReplyFlows)
    .values({
      tenantId,
      triggerPayload,
      responseMessage,
      nextQuickReplies: nextQuickReplies ? JSON.stringify(nextQuickReplies) : null,
    })
    .returning();
  res.status(201).json(flow);
});

// Delete quick reply flow
router.delete('/quick-reply-flows/:id', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  await db.delete(instagramQuickReplyFlows).where(
    and(eq(instagramQuickReplyFlows.id, id), eq(instagramQuickReplyFlows.tenantId, tenantId))
  );
  res.json({ success: true });
});

export default router;
