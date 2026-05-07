import { Router, Request, Response } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
import { orchestrateWebhook } from '../services/webhookOrchestration';
import { orchestrateInstagramDM, orchestrateInstagramComment, orchestrateInstagramStoryInteraction } from '../services/instagramWebhookOrchestration';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Stripe Webhook (Assinaturas)
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Health Check
router.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Webhook principal para Evolution API.
 * Recebe a mensagem, responde OK imediatamente e processa em background.
 */
router.post(['/evolution/:tenantId', '/evolution/:tenantId/:eventName'], express.json(), async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId as string;
  const eventName = req.params.eventName || 'direct';
  const payload = req.body;

  console.log(`[WEBHOOK RECEIVED] Tenant: ${tenantId} | Event: ${eventName} | Type: ${payload?.event || 'unknown'}`);

  try {
    // 1. Resposta imediata para a Evolution API (Evita duplicidade)
    res.status(200).json({ status: 'received', message: 'Processing started' });

    // 2. Orquestração em Background
    // Não usamos 'await' aqui para liberar a resposta HTTP na hora
    orchestrateWebhook(payload, tenantId).catch(err => {
      console.error(`[WEBHOOK BACKGROUND ERROR] Tenant ${tenantId}:`, err.message, err.stack);
    });

  } catch (error: any) {
    console.error(`[WEBHOOK FATAL ERROR] Tenant ${tenantId}:`, error.message);
    // Se ainda não respondeu (erro síncrono antes do res.status), responde erro
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Instagram Webhook — Meta challenge verification (GET)
router.get('/instagram/:tenantId', express.json(), async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') return res.sendStatus(400);

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.instagramWebhookVerifyToken) return res.sendStatus(403);
    if (token !== tenant.instagramWebhookVerifyToken) return res.sendStatus(403);
    return res.status(200).send(challenge);
  } catch {
    return res.sendStatus(500);
  }
});

// Instagram Webhook — receive DM and comment events (POST)
router.post('/instagram/:tenantId', express.json(), async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const payload = req.body;

  console.log(`[INSTAGRAM WEBHOOK] Tenant: ${tenantId} | Object: ${payload?.object}`);

  res.status(200).json({ status: 'received' });

  const hasMessaging = payload?.entry?.[0]?.messaging?.length > 0;
  const hasComments = payload?.entry?.[0]?.changes?.[0]?.field === 'comments';

  if (hasMessaging) {
    const messaging = payload.entry[0].messaging[0];
    const isStoryInteraction =
      messaging?.message?.attachments?.some((a: any) => a.type === 'story_mention') ||
      !!messaging?.message?.reply_to?.story;

    if (isStoryInteraction) {
      orchestrateInstagramStoryInteraction(payload, tenantId).catch(err =>
        console.error('[INSTAGRAM STORY BG ERROR]', err.message)
      );
    } else {
      orchestrateInstagramDM(payload, tenantId).catch(err =>
        console.error('[INSTAGRAM DM BG ERROR]', err.message)
      );
    }
  } else if (hasComments) {
    orchestrateInstagramComment(payload, tenantId).catch(err =>
      console.error('[INSTAGRAM COMMENT BG ERROR]', err.message)
    );
  }
});

export default router;
