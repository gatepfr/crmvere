import { Router } from 'express';
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

    const { evolutionApiUrl, evolutionGlobalToken } = req.body;
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

    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    const result = await evo.createInstance(tenant.slug);
    
    // Some versions of Evolution API return result.hash, others result.instance.token
    // Based on evolutionService.ts it returns response.data
    const token = result.hash || result.instance?.token;

    await db.update(tenants).set({ 
      whatsappInstanceId: tenant.slug,
      whatsappToken: token
    }).where(eq(tenants.id, tenantId));

    // Set Webhook automatically
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    const webhookUrl = `${backendUrl}/api/webhook/evolution/${tenantId}`;
    await evo.setWebhook(tenant.slug, webhookUrl);

    res.json(result);
  } catch (error: any) {
    console.error('Error in /instance/create:', error);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || 'Failed to create instance' 
    });
  }
});

router.get('/instance/qrcode', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken || !tenant?.whatsappInstanceId) {
      return res.status(400).json({ error: 'Evolution API not configured or instance not created' });
    }

    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    const result = await evo.getQrCode(tenant.whatsappInstanceId);
    res.json(result);
  } catch (error: any) {
    console.error('Error in /instance/qrcode:', error);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || 'Failed to get QR Code' 
    });
  }
});

router.get('/instance/status', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    if (!tenant?.evolutionApiUrl || !tenant?.evolutionGlobalToken || !tenant?.whatsappInstanceId) {
      return res.status(400).json({ error: 'Evolution API not configured or instance not created' });
    }

    const evo = new EvolutionService(tenant.evolutionApiUrl, tenant.evolutionGlobalToken);
    const result = await evo.getStatus(tenant.whatsappInstanceId);
    res.json(result);
  } catch (error: any) {
    console.error('Error in /instance/status:', error);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.error || 'Failed to get instance status' 
    });
  }
});

export default router;
