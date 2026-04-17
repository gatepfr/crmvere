import { Router, Request, Response } from 'express';
import { db } from '../db';
import { tenants, demandas, municipes, atendimentos } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { EvolutionService } from '../services/evolutionService';

const router = Router();

// Função para centralizar a obtenção de chaves e URLs
const getEvolutionConfig = (tenant: any) => {
  const internalUrl = 'http://evolution_api:8080';
  const token = tenant?.evolutionGlobalToken || process.env.WA_API_KEY || 'mestre123';
  return { url: internalUrl, token };
};

/**
 * Cria uma nova instância na Evolution API.
 * Limpa instâncias antigas com o mesmo nome antes de criar.
 */
router.post('/instance/create', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(403).json({ error: 'SESSION_INVALID', message: 'Sessão inválida. Por favor, saia e entre novamente.' });
  }

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Gabinete não encontrado.' });

    const config = getEvolutionConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);

    console.log(`[WHATSAPP] Reiniciando instância "${tenant.slug}"...`);
    
    // 1. Tentar deletar se já existir (limpeza)
    await evo.deleteInstance(tenant.slug).catch(() => {});

    // 2. Criar nova
    try {
      const result = await evo.createInstance(tenant.slug);
      const instanceToken = result?.hash?.apikey || result?.instance?.token || 'token_not_found';

      // Salvar dados no banco
      await db.update(tenants).set({ 
        whatsappInstanceId: tenant.slug,
        whatsappToken: instanceToken
      }).where(eq(tenants.id, tenant.id));

      // 3. Configurar Webhook (Evolution para Backend)
      // Usamos a URL PÚBLICA do servidor aqui
      const backendUrl = process.env.BACKEND_URL || 'https://api.crmvere.com.br';
      const webhookUrl = `${backendUrl}/api/webhook/evolution/${tenant.id}`;
      
      await evo.setWebhook(tenant.slug, webhookUrl);
      console.log(`[WHATSAPP] Instância e Webhook configurados com sucesso!`);

      return res.json(result);
    } catch (apiErr: any) {
      console.error('[WHATSAPP API ERROR]', apiErr.response?.data || apiErr.message);
      return res.status(502).json({ 
        error: 'EVOLUTION_API_FAILURE', 
        message: 'A Evolution API recusou a criação da instância.',
        details: apiErr.response?.data || apiErr.message 
      });
    }
  } catch (error: any) {
    console.error('CRASH NO CREATE:', error.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro ao processar criação de WhatsApp.' });
  }
});

router.get('/instance/qrcode', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.whatsappInstanceId) return res.status(200).json({ error: 'instance_not_created' });

    const config = getEvolutionConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    const qr = await evo.getQrCode(tenant.whatsappInstanceId);
    res.json(qr);
  } catch (err: any) {
    res.status(200).json({ error: 'api_unavailable' });
  }
});

router.get('/instance/status', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.whatsappInstanceId) return res.status(200).json({ state: 'not_created' });

    const config = getEvolutionConfig(tenant);
    const evo = new EvolutionService(config.url, config.token);
    const status = await evo.getStatus(tenant.whatsappInstanceId);
    res.json(status);
  } catch (err: any) {
    res.status(200).json({ state: 'error' });
  }
});

router.post('/instance/logout', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (tenant?.whatsappInstanceId) {
      const config = getEvolutionConfig(tenant);
      const evo = new EvolutionService(config.url, config.token);
      await evo.deleteInstance(tenant.whatsappInstanceId).catch(() => {});
      
      await db.update(tenants).set({ 
        whatsappInstanceId: null,
        whatsappToken: null
      }).where(eq(tenants.id, tenant.id));
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao desconectar' });
  }
});

// Envio direto (usado para aniversários e mensagens avulsas)
router.post('/send-direct', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { phone, message } = req.body;

    if (!tenantId || !phone || !message) {
      return res.status(400).json({ error: 'Parâmetros ausentes (phone, message)' });
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant?.whatsappInstanceId) {
      return res.status(400).json({ error: 'WhatsApp não conectado neste gabinete.' });
    }

    const { url, token } = getEvolutionConfig(tenant);
    const evo = new EvolutionService(url, token);
    
    // Normaliza o JID para o envio (garante @s.whatsapp.net)
    const targetJid = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    
    await evo.sendMessage(tenant.whatsappInstanceId, targetJid, message);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending direct message:', error.message);
    res.status(500).json({ error: 'Falha ao enviar mensagem via WhatsApp.' });
  }
});

// Outras rotas manuais simplificadas
router.post('/send', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { demandId, message } = req.body;
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId!));
    const [demand] = await db.select({ demand: demandas, municipe: municipes })
      .from(demandas).innerJoin(municipes, eq(demandas.municipeId, municipes.id))
      .where(and(eq(demandas.id, demandId), eq(demandas.tenantId, tenantId!)));

    if (!tenant?.whatsappInstanceId || !demand) return res.status(404).json({ error: 'Não encontrado' });

    const { url, token } = getEvolutionConfig(tenant);
    const evo = new EvolutionService(url, token);
    await evo.sendMessage(tenant.whatsappInstanceId, demand.municipe.phone, message);

    // 1. Atualiza o histórico da demanda
    await db.update(demandas).set({ 
        descricao: `${demand.demand.descricao}\n\nGabinete: ${message}`,
        updatedAt: new Date() 
    }).where(eq(demandas.id, demandId));

    // 2. Atualiza o atendimento (para calar a IA por 10 min)
    // Buscamos o atendimento de hoje deste munícipe
    await db.update(atendimentos).set({
        updatedAt: new Date(), 
        lastHumanInteractionAt: new Date(), // MARCAÇÃO HUMANA AQUI
        resumoIa: sql`${atendimentos.resumoIa} || '\n\nGabinete: ' || ${message}`
    }).where(and(
        eq(atendimentos.municipeId, demand.municipe.id),
        eq(atendimentos.tenantId, tenantId!),
        sql`date_trunc('day', ${atendimentos.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`
    ));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao enviar' });
  }
});

export default router;
