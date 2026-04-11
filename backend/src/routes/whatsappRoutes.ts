import { Router } from 'express';
import axios from 'axios';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { EvolutionService } from '../services/evolutionService';

const router = Router();
router.use(authenticate);

router.post('/setup', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    let { evolutionApiUrl, evolutionGlobalToken } = req.body;
    
    // Auto-fix URL if protocol is missing
    if (evolutionApiUrl && !evolutionApiUrl.startsWith('http')) {
      evolutionApiUrl = `http://${evolutionApiUrl}`;
    }

    await db.update(tenants)
      .set({ evolutionApiUrl, evolutionGlobalToken })
      .where(eq(tenants.id, tenantId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/instance/create', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    
    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken) {
      return res.status(400).json({ error: 'Evolution API credentials not configured' });
    }

    const evolutionApiUrl = tenant?.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
    const evolutionGlobalToken = tenant?.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';

    const evo = new EvolutionService(evolutionApiUrl, evolutionGlobalToken);
    
    // Create new instance without prior deletion to simplify
    const result = await evo.createInstance(tenant.slug);
    
    const token = result.hash?.apikey || result.instance?.token || 'token_not_found';

    await db.update(tenants).set({ 
      whatsappInstanceId: tenant.slug,
      whatsappToken: token
    }).where(eq(tenants.id, tenantId));

    // Webhook setup
    const backendUrl = process.env.BACKEND_URL || 'https://api.crmvere.com.br';
    const webhookUrl = `${backendUrl}/api/webhook/evolution/${tenantId}`;
    console.log(`[WHATSAPP] Setting webhook for ${tenant.slug} to ${webhookUrl}`);
    
    evo.setWebhook(tenant.slug, webhookUrl)
      .catch(e => console.error('Silent Webhook Error:', e.message));

    res.json(result);
  } catch (error: any) {
    console.error('CRASH NA CRIAÇÃO:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/instance/qrcode', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken || !tenant?.whatsappInstanceId) {
      return res.status(200).json({ error: 'not_configured' });
    }

    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    try {
      const result = await evo.getQrCode(tenant.whatsappInstanceId);
      res.json(result);
    } catch (apiError: any) {
      // Return 200 with error info so frontend doesn't crash
      res.status(200).json({ error: 'api_unavailable', message: apiError.message });
    }
  } catch (error: any) {
    console.error('Error in /instance/qrcode:', error.message);
    res.status(200).json({ error: 'server_error' });
  }
});

router.get('/instance/status', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken || !tenant?.whatsappInstanceId) {
      return res.status(200).json({ state: 'not_created' });
    }

    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    try {
      const result = await evo.getStatus(tenant.whatsappInstanceId);
      res.json(result);
    } catch (apiError: any) {
      // If instance doesn't exist in Evolution API, return not_created instead of 500
      if (apiError.response?.status === 404) {
        return res.status(200).json({ state: 'not_created' });
      }
      throw apiError;
    }
  } catch (error: any) {
    console.error('Error in /instance/status:', error.message);
    res.status(200).json({ state: 'error', message: error.message });
  }
});

export default router;
