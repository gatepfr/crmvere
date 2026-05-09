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
router.get(['/instagram', '/instagram/:tenantId'], async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // If no mode, it's likely a manual browser access to test if the route is open
  if (!mode) {
    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
            <h1 style="color: #1e40af;">Webhook Instagram Ativo 🚀</h1>
            <p style="color: #64748b;">Esta rota está pronta para receber conexões da Meta.</p>
            <code style="display: block; margin-top: 1rem; padding: 0.5rem; background: #f1f5f9; border-radius: 0.5rem; font-size: 0.875rem;">
              Tenant: ${tenantId || 'Global'}
            </code>
          </div>
        </body>
      </html>
    `);
  }

  console.log(`[INSTAGRAM VERIFY ATTEMPT] Tenant: ${tenantId || 'global'} | Token received: ${token}`);

  if (mode !== 'subscribe') {
    console.warn('[INSTAGRAM VERIFY] Invalid mode:', mode);
    return res.sendStatus(400);
  }

  // 1. Try per-tenant verification
  if (tenantId && !['SEU_TENANT_ID', '...', 'undefined', 'null'].includes(tenantId)) {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (tenant?.instagramWebhookVerifyToken && token === tenant.instagramWebhookVerifyToken) {
        console.log(`[INSTAGRAM VERIFY] Success for tenant: ${tenantId}`);
        return res.status(200).send(challenge);
      }
    } catch (e: any) {
      console.error('[INSTAGRAM WEBHOOK VERIFY DB ERROR]', e.message);
    }
  }

  // 2. Fallback to global verification token from .env
  if (token && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    console.log('[INSTAGRAM VERIFY] Success using global token');
    return res.status(200).send(challenge);
  }

  console.warn(`[INSTAGRAM VERIFY] Unauthorized attempt. Expected: ${process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN}, Received: ${token}`);
  return res.sendStatus(403);
});

// Instagram Webhook — app-level event receiver (POST)
// Routes to the correct tenant by looking up instagramAccountId from the payload,
// or uses tenantId from the URL if provided.
router.post(['/instagram', '/instagram/:tenantId'], express.json(), async (req: Request, res: Response) => {
  const { tenantId: tenantIdParam } = req.params;
  const payload = req.body;
  const igAccountId = payload?.entry?.[0]?.id;

  console.log(`[INSTAGRAM WEBHOOK] AccountId: ${igAccountId} | Object: ${payload?.object} | TenantParam: ${tenantIdParam}`);

  res.status(200).json({ status: 'received' });

  try {
    let tenantId = tenantIdParam;

    // If no tenantId in URL, must find by igAccountId
    if (!tenantId) {
      if (!igAccountId) return;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.instagramAccountId, igAccountId));
      if (!tenant) {
        console.warn(`[INSTAGRAM WEBHOOK] No tenant found for accountId: ${igAccountId}`);
        return;
      }
      tenantId = tenant.id;
    }

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
