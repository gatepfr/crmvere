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

// Instagram Webhook — app-level verification (GET)
// Meta calls this once when the CRM owner configures the webhook in the Meta portal.
// Uses INSTAGRAM_WEBHOOK_VERIFY_TOKEN from .env — no per-tenant logic needed here.
router.get('/instagram', express.json(), (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') return res.sendStatus(400);
  if (token !== process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) return res.sendStatus(403);
  return res.status(200).send(challenge);
});

// Instagram Webhook — app-level event receiver (POST)
// Routes to the correct tenant by looking up instagramAccountId from the payload.
router.post('/instagram', express.json(), async (req: Request, res: Response) => {
  const payload = req.body;
  const igAccountId = payload?.entry?.[0]?.id;

  console.log(`[INSTAGRAM WEBHOOK] AccountId: ${igAccountId} | Object: ${payload?.object}`);

  res.status(200).json({ status: 'received' });

  if (!igAccountId) return;

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.instagramAccountId, igAccountId));
    if (!tenant) {
      console.warn(`[INSTAGRAM WEBHOOK] No tenant found for accountId: ${igAccountId}`);
      return;
    }

    const tenantId = tenant.id;
    const hasMessaging = payload?.entry?.[0]?.messaging?.length > 0;
    const hasComments = payload?.entry?.[0]?.changes?.[0]?.field === 'comments';

    if (hasMessaging) {
      const messaging = payload.entry[0].messaging[0];
      const isStoryInteraction =
        messaging?.message?.attachments?.some((a: any) => a.type === 'story_mention') ||
        !!messaging?.message?.reply_to?.story;

      if (isStoryInteraction) {
        orchestrateInstagramStoryInteraction(payload, tenantId).catch((err: any) =>
          console.error('[INSTAGRAM STORY BG ERROR]', err.message)
        );
      } else {
        orchestrateInstagramDM(payload, tenantId).catch((err: any) =>
          console.error('[INSTAGRAM DM BG ERROR]', err.message)
        );
      }
    } else if (hasComments) {
      orchestrateInstagramComment(payload, tenantId).catch((err: any) =>
        console.error('[INSTAGRAM COMMENT BG ERROR]', err.message)
      );
    }
  } catch (err: any) {
    console.error('[INSTAGRAM WEBHOOK ROUTING ERROR]', err.message);
  }
});

export default router;
