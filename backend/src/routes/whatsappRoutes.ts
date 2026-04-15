import { Router, Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db';
import { tenants, demandas, municipes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { EvolutionService } from '../services/evolutionService';

const router = Router();
router.use(authenticate);

// Utilitário para pegar as configurações da Evolution API com correção de porta/protocolo
const getEvoConfig = (tenant: any) => {
  // Se o .env tiver a porta 8080 com https, o Nginx pode barrar. Vamos limpar.
  let url = tenant?.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'https://wa.crmvere.com.br';
  
  if (url.includes(':8080') && url.startsWith('https')) {
      url = url.replace(':8080', '');
  }
  
  // No seu .env a chave é WA_API_KEY
  const token = tenant?.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
  
  return { url, token };
};

router.post('/instance/create', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    
    // Busca o tenant
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant) {
        return res.status(404).json({ error: 'Nenhum gabinete (tenant) encontrado no banco de dados.' });
    }
    
    const config = getEvoConfig(tenant);
    console.log(`[WHATSAPP] Tentando criar instância em: ${config.url}`);

    const evo = new EvolutionService(config.url, config.token);
    
    // Tenta criar a instância. Se a Evolution API der erro, capturamos aqui.
    let result;
    try {
        result = await evo.createInstance(tenant.slug);
    } catch (apiErr: any) {
        console.error('[WHATSAPP API ERROR]', apiErr.response?.data || apiErr.message);
        return res.status(502).json({ 
            error: 'A Evolution API retornou um erro.', 
            details: apiErr.response?.data || apiErr.message 
        });
    }
    
    const token = result?.hash?.apikey || result?.instance?.token || 'token_not_found';

    // Salva o ID da instância no banco
    await db.update(tenants).set({ 
      whatsappInstanceId: tenant.slug,
      whatsappToken: token
    }).where(eq(tenants.id, tenant.id));

    // Configura o Webhook
    const backendUrl = process.env.BACKEND_URL || 'https://api.crmvere.com.br';
    const webhookUrl = `${backendUrl}/api/webhook/evolution/${tenant.id}`;
    
    try {
      await evo.setWebhook(tenant.slug, webhookUrl);
      console.log(`[WHATSAPP] Webhook configurado: ${webhookUrl}`);
    } catch (e: any) {
      console.error(`[WHATSAPP WEBHOOK ERROR]`, e.message);
    }

    res.json(result);
  } catch (error: any) {
    console.error('CRASH NA CRIAÇÃO:', error.message);
    res.status(500).json({ error: 'Erro interno ao processar criação de instância.' });
  }
});

router.get('/instance/qrcode', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant?.whatsappInstanceId) return res.status(200).json({ error: 'instance_not_created' });

    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    try {
      const result = await evo.getQrCode(tenant.whatsappInstanceId);
      res.json(result);
    } catch (apiError: any) {
      res.status(200).json({ error: 'api_unavailable', message: apiError.message });
    }
  } catch (error: any) {
    res.status(200).json({ error: 'server_error' });
  }
});

router.get('/instance/status', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    let [tenant] = tenantId 
      ? await db.select().from(tenants).where(eq(tenants.id, tenantId))
      : await db.select().from(tenants).limit(1);

    if (!tenant?.whatsappInstanceId) return res.status(200).json({ state: 'not_created' });

    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    try {
      const result = await evo.getStatus(tenant.whatsappInstanceId);
      res.json(result);
    } catch (apiError: any) {
      if (apiError.response?.status === 404) return res.status(200).json({ state: 'not_created' });
      res.status(200).json({ state: 'error' });
    }
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
      const config = getEvoConfig(tenant);
      const evo = new EvolutionService(config.url, config.token);
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

    let { whatsappNotificationNumber } = req.body;
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

    if (!tenant?.whatsappInstanceId || !demand) return res.status(404).json({ error: 'Dados não encontrados' });

    const config = getEvoConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    await evo.sendMessage(tenant.whatsappInstanceId, demand.municipe.phone, message);

    await db.update(demandas).set({ 
        resumoIa: `${demand.demand.resumoIa}\n\nGabinete: ${message}`,
        updatedAt: new Date() 
    }).where(eq(demandas.id, demandId));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

export default router;
