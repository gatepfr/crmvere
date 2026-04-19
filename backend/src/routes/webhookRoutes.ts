import { Router, Request, Response } from 'express';
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';
import { orchestrateWebhook } from '../services/webhookOrchestration';

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

export default router;
