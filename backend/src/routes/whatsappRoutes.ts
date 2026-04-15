import { Router } from 'express';
import axios from 'axios';
import { db } from '../db';
import { tenants, demandas, municipes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { EvolutionService } from '../services/evolutionService';

const router = Router();
router.use(authenticate);

router.post('/send', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { demandId, message } = req.body;

    if (!tenantId || !demandId || !message) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // 1. Get tenant and demand info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    const [demand] = await db.select({
      demand: demandas,
      municipe: municipes
    })
    .from(demandas)
    .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
    .where(and(eq(demandas.id, demandId), eq(demandas.tenantId, tenantId)));

    if (!tenant || !demand) {
      return res.status(404).json({ error: 'Tenant or Demand not found' });
    }

    if (!tenant.whatsappInstanceId || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }

    // 2. Send via Evolution API
    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    await evo.sendMessage(tenant.whatsappInstanceId, demand.municipe.phone, message);

    // 3. Update conversation history in DB
    const updatedHistory = `${demand.demand.resumoIa}\n\nGabinete: ${message}`;
    
    await db.update(demandas)
      .set({ 
        resumoIa: updatedHistory,
        updatedAt: new Date()
      })
      .where(eq(demandas.id, demandId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending manual message:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/send-direct', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { phone, message } = req.body;

    if (!tenantId || !phone || !message) {
      return res.status(400).json({ error: 'Missing parameters (phone, message)' });
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (!tenant || !tenant.whatsappInstanceId || !tenant.evolutionApiUrl || !tenant.evolutionGlobalToken) {
      return res.status(400).json({ error: 'WhatsApp not configured for this tenant' });
    }

    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    await evo.sendMessage(tenant.whatsappInstanceId, phone, message);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending direct message:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    let { evolutionApiUrl, evolutionGlobalToken, whatsappNotificationNumber } = req.body;
    
    // Auto-fix URL if protocol is missing
    if (evolutionApiUrl && !evolutionApiUrl.startsWith('http')) {
      evolutionApiUrl = `http://${evolutionApiUrl}`;
    }

    await db.update(tenants)
      .set({ evolutionApiUrl, evolutionGlobalToken, whatsappNotificationNumber })
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
    
    // Fallback to environment variables if tenant doesn't have specific credentials
    const evolutionApiUrl = tenant?.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
    const evolutionGlobalToken = tenant?.evolutionGlobalToken || process.env.EVOLUTION_API_TOKEN || 'mestre123';

    if (!evolutionApiUrl || !evolutionGlobalToken) {
      return res.status(400).json({ error: 'Evolution API credentials not configured' });
    }

    // Save credentials to tenant if they were missing, so frontend/webhooks can use them
    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken) {
      await db.update(tenants).set({ 
        evolutionApiUrl, 
        evolutionGlobalToken 
      }).where(eq(tenants.id, tenantId));
    }

    const evo = new EvolutionService(evolutionApiUrl, evolutionGlobalToken);
    
    // Create new instance without prior deletion to simplify
    const result = await evo.createInstance(tenant.slug);
    
    const token = result.hash?.apikey || result.instance?.token || 'token_not_found';

    await db.update(tenants).set({ 
      whatsappInstanceId: tenant.slug,
      whatsappToken: token
    }).where(eq(tenants.id, tenantId));

    // Webhook setup - USANDO URL INTERNA DO DOCKER para maior estabilidade
    // Isso garante que o container evolution_api consiga falar com o container backend
    const webhookUrl = `http://backend:3001/api/webhook/evolution/${tenantId}`;
    console.log(`[WHATSAPP] Configurando Webhook INTERNO para instância ${tenant.slug} -> URL: ${webhookUrl}`);
    
    try {
      await evo.setWebhook(tenant.slug, webhookUrl);
      console.log(`[WHATSAPP] Webhook configurado com sucesso via rede interna!`);
    } catch (e: any) {
      console.error(`[WHATSAPP ERROR] Falha ao configurar Webhook:`, e.response?.data || e.message);
    }

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

router.post('/instance/logout', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    
    if (tenant?.whatsappInstanceId) {
      const evolutionApiUrl = tenant?.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
      const evolutionGlobalToken = tenant?.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
      const evo = new EvolutionService(evolutionApiUrl, evolutionGlobalToken);
      
      try {
        await evo.deleteInstance(tenant.whatsappInstanceId);
      } catch (e) {
        console.error('Error deleting instance on logout:', e);
      }
    }

    await db.update(tenants).set({ 
      whatsappInstanceId: null,
      whatsappToken: null
    }).where(eq(tenants.id, tenantId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error in /instance/logout:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
