import { Router } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/me', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  res.json(tenant);
});

router.patch('/update', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  
  const { 
    name, 
    aiProvider, 
    aiApiKey, 
    aiModel, 
    aiBaseUrl,
    systemPrompt,
    municipio,
    uf,
    partido,
    mandato,
    fotoUrl,
    calendarUrl
  } = req.body;

  await db.update(tenants)
    .set({ 
      name, 
      aiProvider, 
      aiApiKey, 
      aiModel, 
      aiBaseUrl,
      systemPrompt,
      municipio,
      uf,
      partido,
      mandato,
      fotoUrl,
      calendarUrl
    })
    .where(eq(tenants.id, tenantId));
    
  res.json({ success: true });
});

export default router;
