import { Router, Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { checkTenant } from '../middleware/tenant';

const router = Router();

// Mock coordinates for common neighborhood names.
// These are centered around a generic city (defaults to SP center)
const neighborhoodCoords: Record<string, { lat: number; lng: number }> = {
  'Centro': { lat: -23.5489, lng: -46.6388 },
  'Pinheiros': { lat: -23.5617, lng: -46.7020 },
  'Moema': { lat: -23.5992, lng: -46.6631 },
  'Itaim Bibi': { lat: -23.5852, lng: -46.6817 },
  'Vila Mariana': { lat: -23.5891, lng: -46.6341 },
};

router.get('/data', authenticate, checkTenant, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context' });
  }

  try {
    const stats = await db.select({
      bairro: municipes.bairro,
      count: sql<number>`count(*)::int`
    })
    .from(demandas)
    .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
    .where(eq(demandas.tenantId, tenantId))
    .groupBy(municipes.bairro);

    const data = stats.map(stat => {
      const bairro = stat.bairro || 'Desconhecido';
      
      // Use predefined coordinates or generate random ones nearby if not found
      const coords = neighborhoodCoords[bairro] || {
        lat: -23.5489 + (Math.random() - 0.5) * 0.15,
        lng: -46.6388 + (Math.random() - 0.5) * 0.15,
      };

      return {
        bairro,
        count: Number(stat.count),
        lat: coords.lat,
        lng: coords.lng,
      };
    });

    res.json(data);
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

export default router;
