import { Router } from 'express';
import { db } from '../db';
import { campaigns, campaignColumns, leads, demandas, municipes } from '../db/schema';
import { eq, and, asc, notInArray, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Get Demands not yet in Kanban
router.get('/pending-demands', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    // Subquery to get municipeIds already in leads for this tenant
    const existingLeads = await db.select({ id: leads.municipeId })
      .from(leads)
      .where(eq(leads.tenantId, tenantId));
    
    const excludedIds = existingLeads.map(l => l.id).filter(Boolean) as string[];

    const whereConditions = [eq(demandas.tenantId, tenantId)];
    if (excludedIds.length > 0) {
      whereConditions.push(notInArray(demandas.municipeId, excludedIds));
    }

    const list = await db.select({
      id: demandas.id,
      resumoIa: demandas.descricao,
      categoria: demandas.categoria,
      createdAt: demandas.createdAt,
      municipe: {
        id: municipes.id,
        name: municipes.name,
        phone: municipes.phone
      }
    })
    .from(demandas)
    .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
    .where(and(...whereConditions))
    .orderBy(asc(demandas.createdAt));
    
    res.json(list);
  } catch (error) {
    console.error('Failed to fetch pending demands:', error);
    res.status(500).json({ error: 'Failed to fetch pending demands' });
  }
});

// List Campaigns
router.get('/campaigns', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const list = await db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)).orderBy(asc(campaigns.createdAt));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

// Create Campaign
router.post('/campaigns', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { name } = req.body;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const result = await db.transaction(async (tx) => {
      const [newCampaign] = await tx.insert(campaigns).values({
        tenantId,
        name
      }).returning();

      // Create default columns
      await tx.insert(campaignColumns).values([
        { campaignId: newCampaign.id, name: 'Novos', order: 0 },
        { campaignId: newCampaign.id, name: 'Em Contato', order: 1 },
        { campaignId: newCampaign.id, name: 'Convertidos', order: 2 }
      ]);

      return newCampaign;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get Board State (Columns + Leads)
router.get('/boards/:campaignId', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { campaignId } = req.params;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    // Verify campaign belongs to tenant
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)));
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const columns = await db.select().from(campaignColumns).where(eq(campaignColumns.campaignId, campaignId)).orderBy(asc(campaignColumns.order));
    const boardLeads = await db.select().from(leads).where(and(eq(leads.campaignId, campaignId), eq(leads.tenantId, tenantId))).orderBy(asc(leads.createdAt));

    res.json({ columns, leads: boardLeads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch board data' });
  }
});

// Add Lead to Campaign
router.post('/campaigns/:campaignId/leads', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { campaignId } = req.params;
  const { name, email, phone, notes, municipeId } = req.body;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    // Get the first column to place the lead
    const [firstColumn] = await db.select().from(campaignColumns).where(eq(campaignColumns.campaignId, campaignId)).orderBy(asc(campaignColumns.order)).limit(1);
    
    if (!firstColumn) return res.status(400).json({ error: 'No columns found in this campaign' });

    const [newLead] = await db.insert(leads).values({
      tenantId,
      campaignId,
      columnId: firstColumn.id,
      name,
      email,
      phone,
      notes,
      municipeId // Link to municipe if provided
    }).returning();

    res.status(201).json(newLead);
  } catch (error) {
    console.error('Error adding lead:', error);
    res.status(500).json({ error: 'Failed to add lead' });
  }
});

// Move Lead to another column
router.patch('/leads/:id/move', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  const { columnId } = req.body;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [updatedLead] = await db.update(leads)
      .set({ columnId })
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))
      .returning();

    if (!updatedLead) return res.status(404).json({ error: 'Lead not found' });
    res.json(updatedLead);
  } catch (error) {
    res.status(500).json({ error: 'Failed to move lead' });
  }
});

// Add Column to Campaign
router.post('/campaigns/:campaignId/columns', async (req, res) => {
  const { campaignId } = req.params;
  const { name } = req.body;

  try {
    const [lastCol] = await db.select().from(campaignColumns).where(eq(campaignColumns.campaignId, campaignId)).orderBy(asc(campaignColumns.order)).limit(1);
    const order = lastCol ? lastCol.order + 1 : 0;

    const [newCol] = await db.insert(campaignColumns).values({
      campaignId,
      name,
      order
    }).returning();

    res.status(201).json(newCol);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add column' });
  }
});

// Delete Column
router.delete('/columns/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(campaignColumns).where(eq(campaignColumns.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

// Delete Lead
router.delete('/leads/:id', async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    await db.delete(leads).where(
      and(
        eq(leads.id, id), 
        eq(leads.tenantId, tenantId)
      )
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

export default router;
