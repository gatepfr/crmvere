import { Router, Request, Response } from 'express';
import { db } from '../db';
import { demandas, municipes, tenants } from '../db/schema';
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

import axios from 'axios';

// Helper to get coordinates from OpenStreetMap (Nominatim)
async function getCoordinates(bairro: string, city: string, state: string) {
  try {
    const query = `${bairro}, ${city}, ${state}, Brasil`;
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'VereadorCRM-MVP'
      }
    });

    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error(`Geocoding error for ${bairro}:`, error);
    return null;
  }
}

router.get('/data', authenticate, checkTenant, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    const city = tenant?.municipio || 'São Paulo';
    const state = tenant?.uf || 'SP';
    
    const stats = await db.select({
      bairro: municipes.bairro,
      count: sql<number>`count(*)::int`
    })
    .from(demandas)
    .innerJoin(municipes, eq(demandas.municipeId, municipes.id))
    .where(eq(demandas.tenantId, tenantId))
    .groupBy(municipes.bairro);

    // Fetch real coordinates for each neighborhood
    const points = await Promise.all(stats.map(async (stat) => {
      const bairro = stat.bairro || 'Centro';
      
      // Try to geocode
      const coords = await getCoordinates(bairro, city, state);
      
      if (coords) {
        return {
          bairro,
          count: stat.count,
          lat: coords.lat,
          lng: coords.lng
        };
      }

      // Fallback to random point near city center if geocoding fails
      // We'll use a hardcoded center for fallback based on common cities or a generic one
      const baseLat = city.toLowerCase() === 'apucarana' ? -23.5505 : -23.5489;
      const baseLng = city.toLowerCase() === 'apucarana' ? -51.4614 : -46.6388;

      return {
        bairro,
        count: stat.count,
        lat: baseLat + (Math.random() - 0.5) * 0.05,
        lng: baseLng + (Math.random() - 0.5) * 0.05,
      };
    }));

    res.json({
      city,
      state,
      points
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

export default router;
