import { Router } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { redisService } from '../services/redisService';

const router = Router();
router.use(authenticate);

router.get('/me', async (req, res) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    if (req.user?.role === 'super_admin') {
      return res.json({ name: 'Central Super Admin', isSuperAdmin: true });
    }
    return res.status(403).json({ error: 'No tenant context' });
  }
  
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  // Get current daily usage from Redis
  const today = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
  const currentUsage = await redisService.getUsage(tenantId, today);

  res.json({
    ...tenant,
    aiQuota: {
      usage: currentUsage,
      limit: tenant.dailyTokenLimit,
      isBlocked: tenant.blocked
    }
  });
});

router.patch('/update', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  const {
    name, aiProvider, aiApiKey, aiModel, aiBaseUrl, systemPrompt,
    municipio, uf, partido, mandato, fotoUrl, calendarUrl,
    birthdayMessage, birthdayAutomated, legislativeMessage,
    whatsappVereadorNumber, followUpEnabled, followUpDays, followUpMessage
  } = req.body;

  await db.update(tenants)
    .set({
      name, aiProvider, aiApiKey, aiModel, aiBaseUrl, systemPrompt,
      municipio, uf, partido, mandato, fotoUrl, calendarUrl,
      birthdayMessage, birthdayAutomated, legislativeMessage,
      whatsappVereadorNumber, followUpEnabled, followUpDays, followUpMessage
    })
    .where(eq(tenants.id, tenantId));

  res.json({ success: true });
});

export default router;
