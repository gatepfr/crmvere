import { Router, Request, Response } from 'express';
import { db } from '../db';
import { tenants, demandas, municipes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { EvolutionService } from '../services/evolutionService';

const router = Router();
router.use(authenticate);

// Utilitário centralizado para configurações da Evolution
const getEvoConfig = (tenant: any) => {
  let url = tenant?.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
  
  // Se for https e tiver a porta 8080, limpamos para usar a porta padrão 443 do SSL
  if (url.startsWith('https') && url.includes(':8080')) {
    url = url.replace(':8080', '');
  }
  
  // Usa a chave que está no seu .env
  const token = tenant?.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
  
  return { url, token };
};

router.post('/instance/create', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    // Busca o tenant do usuário ou o primeiro disponível
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant) {
      return res.status(404).json({ error: 'Gabinete não encontrado.' });
    }
    
    const { url, token } = getEvoConfig(tenant);
    const evo = new EvolutionService(url, token);
    
    const result = await evo.createInstance(tenant.slug);
    const instanceToken = result?.hash?.apikey || result?.instance?.token || 'token_not_found';

    await db.update(tenants).set({ 
      whatsappInstanceId: tenant.slug,
      whatsappToken: instanceToken
    }).where(eq(tenants.id, tenant.id));

    const backendUrl = process.env.BACKEND_URL || 'https://api.crmvere.com.br';
    const webhookUrl = `${backendUrl}/api/webhook/evolution/${tenant.id}`;
    
    await evo.setWebhook(tenant.slug, webhookUrl).catch(e => console.error('Erro Webhook:', e.message));

    res.json(result);
  } catch (error: any) {
    console.error('Erro na criação de instância:', error.message);
    res.status(500).json({ error: 'Falha ao conectar com a Evolution API. Verifique a URL e a API Key.' });
  }
});

router.get('/instance/qrcode', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant?.whatsappInstanceId) return res.status(200).json({ error: 'instance_not_created' });

    const { url, token } = getEvoConfig(tenant);
    const evo = new EvolutionService(url, token);
    const qr = await evo.getQrCode(tenant.whatsappInstanceId);
    res.json(qr);
  } catch (error: any) {
    res.status(200).json({ error: 'api_unavailable' });
  }
});

router.get('/instance/status', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant?.whatsappInstanceId) return res.status(200).json({ state: 'not_created' });

    const { url, token } = getEvoConfig(tenant);
    const evo = new EvolutionService(url, token);
    const status = await evo.getStatus(tenant.whatsappInstanceId);
    res.json(status);
  } catch (error: any) {
    res.status(200).json({ state: 'error' });
  }
});

router.post('/instance/logout', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (tenant?.whatsappInstanceId) {
      const { url, token } = getEvoConfig(tenant);
      const evo = new EvolutionService(url, token);
      await evo.deleteInstance(tenant.whatsappInstanceId).catch(() => {});
      
      await db.update(tenants).set({ 
        whatsappInstanceId: null,
        whatsappToken: null
      }).where(eq(tenants.id, tenant.id));
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/setup', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });
    const { whatsappNotificationNumber } = req.body;
    await db.update(tenants).set({ whatsappNotificationNumber }).where(eq(tenants.id, tenantId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { demandId, message } = req.body;
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId!));
    const [demand] = await db.select({ demand: demandas, municipe: municipes })
      .from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(and(eq(demandas.id, demandId), eq(demandas.tenantId, tenantId!)));

    if (!tenant?.whatsappInstanceId || !demand) return res.status(404).json({ error: 'Not found' });

    const { url, token } = getEvoConfig(tenant);
    const evo = new EvolutionService(url, token);
    await evo.sendMessage(tenant.whatsappInstanceId, demand.municipe.phone, message);

    await db.update(demandas).set({ 
        resumoIa: `${demand.demand.resumoIa}\n\nGabinete: ${message}`,
        updatedAt: new Date() 
    }).where(eq(demandas.id, demandId));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

export default router;
