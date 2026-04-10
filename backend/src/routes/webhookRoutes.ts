import { Router, Request, Response } from 'express';
import { normalizeEvolution } from '../services/whatsappService';

const router = Router();

/**
 * Webhook endpoint for Evolution API.
 * Route: POST /api/webhook/evolution/:tenantId
 */
router.post('/evolution/:tenantId', (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const payload = req.body;

  try {
    const normalized = normalizeEvolution(payload, tenantId);
    
    // For now, we just log the normalized message. 
    // In the next tasks, this will be sent to the AI engine.
    console.log('Normalized WhatsApp message:', JSON.stringify(normalized, null, 2));

    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
