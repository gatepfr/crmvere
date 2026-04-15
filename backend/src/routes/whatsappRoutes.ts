import { Router, Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db';
import { tenants, demandas, municipes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { EvolutionService } from '../services/evolutionService';

const router = Router();
router.use(authenticate);

// Utilitário para pegar as configurações da Evolution API
const getEvoConfig = (tenant: any) => {
  let url = tenant?.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
  // Correção de URL: se for https, removemos a porta 8080 que é para http
  if (url.startsWith('https://') && url.includes(':8080')) {
    url = url.replace(':8080', '');
  }
  const token = tenant?.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
  return { url, token };
};

router.post('/send', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { demandId, message } = req.body;

    if (!tenantId || !demandId || !message) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

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

    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    await evo.sendMessage(tenant.whatsappInstanceId!, demand.municipe.phone, message);

    const updatedHistory = `${demand.demand.resumoIa}\n\nGabinete: ${message}`;
    
    await db.update(demandas)
      .set({ resumoIa: updatedHistory, updatedAt: new Date() })
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
    const config = getEvoConfig(tenant);
    
    if (!tenant?.whatsappInstanceId) {
      return res.status(400).json({ error: 'WhatsApp not configured for this tenant' });
    }

    const evo = new EvolutionService(config.url, config.token);
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
    
    if (evolutionApiUrl && !evolutionApiUrl.startsWith('http')) {
      evolutionApiUrl = `https://${evolutionApiUrl}`;
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
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant) {
        // Criação de emergência se não houver tenant
        console.log("[WHATSAPP] Criando tenant de emergência...");
        const [newTenant] = await db.insert(tenants).values({
            name: 'Gabinete Digital',
            slug: 'gabinete',
        }).returning();
        tenant = newTenant;
    }
    
    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    const result = await evo.createInstance(tenant.slug);
    
    const token = result.hash?.apikey || result.instance?.token || 'token_not_found';

    await db.update(tenants).set({ 
      whatsappInstanceId: tenant.slug,
      whatsappToken: token
    }).where(eq(tenants.id, tenant.id));

    const backendUrl = process.env.BACKEND_URL || 'https://api.crmvere.com.br';
    const webhookUrl = `${backendUrl}/api/webhook/evolution/${tenant.id}`;
    
    try {
      await evo.setWebhook(tenant.slug, webhookUrl);
    } catch (e: any) {
      console.error(`[WHATSAPP ERROR] Falha ao configurar Webhook:`, e.message);
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
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant) return res.status(200).json({ error: 'tenant_not_found' });

    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    try {
      const result = await evo.getQrCode(tenant.whatsappInstanceId!);
      res.json(result);
    } catch (apiError: any) {
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
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant) return res.status(200).json({ state: 'not_created' });

    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    try {
      const result = await evo.getStatus(tenant.whatsappInstanceId!);
      res.json(result);
    } catch (apiError: any) {
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
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    const config = getEvoConfig(tenant);

    if (tenant?.whatsappInstanceId) {
      const evo = new EvolutionService(config.url, config.token);
      try {
        await evo.deleteInstance(tenant.whatsappInstanceId);
      } catch (e) {
        console.error('Error deleting instance on logout:', e);
      }
    }

    if (tenant) {
      await db.update(tenants).set({ 
        whatsappInstanceId: null,
        whatsappToken: null
      }).where(eq(tenants.id, tenant.id));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error in /instance/logout:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
