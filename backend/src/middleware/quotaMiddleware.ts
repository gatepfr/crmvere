import type { Request, Response, NextFunction } from 'express';
import { redisService } from '../services/redisService';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Middleware to check AI quota and kill switch before allowing AI processing
 */
export const checkAIQuota = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context' });
  }

  try {
    // 1. Check Kill Switch
    const isBlocked = await redisService.isBlocked(tenantId);
    if (isBlocked) {
      return res.status(403).json({ error: 'Este gabinete está temporariamente bloqueado para uso de IA.' });
    }

    // 2. Get Usage and Limit
    const today = new Date().toISOString().split('T')[0];
    const usage = await redisService.getUsage(tenantId, today);
    
    let limit = await redisService.getLimit(tenantId);

    // If limit not in cache, get from DB and cache it
    if (limit === null) {
      const [tenant] = await db.select({ 
        dailyTokenLimit: tenants.dailyTokenLimit,
        blocked: tenants.blocked
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      
      // Secondary check for DB-level block
      if (tenant.blocked) {
        await redisService.setBlockedStatus(tenantId, true);
        return res.status(403).json({ error: 'Este gabinete está bloqueado.' });
      }

      limit = tenant.dailyTokenLimit;
      await redisService.setLimit(tenantId, limit);
    }

    // 3. Compare Usage vs Limit
    if (usage >= limit) {
      return res.status(429).json({ 
        error: 'Limite diário de tokens de IA atingido.',
        usage,
        limit
      });
    }

    // Attach usage data to request for later update
    req.aiQuota = { usage, limit, today };
    
    next();
  } catch (error) {
    console.error('[QUOTA MIDDLEWARE] Error:', error);
    next(); // Proceed anyway to avoid breaking the app if Redis fails, or adjust based on safety needs
  }
};

/**
 * Helper to update usage after AI call
 */
export const trackAIUsage = async (tenantId: string, tokens: number) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Update Redis (Real-time)
    await redisService.incrementUsage(tenantId, today, tokens);

    // 2. Sync to Postgres (Persistence) - Async
    db.update(tenants)
      .set({ 
        tokenUsageTotal: sql`${tenants.tokenUsageTotal} + ${tokens}` 
      })
      .where(eq(tenants.id, tenantId))
      .then(() => console.log(`[QUOTA] DB Sync successful for tenant ${tenantId}`))
      .catch(err => console.error(`[QUOTA] DB Sync failed:`, err));
      
  } catch (error) {
    console.error('[QUOTA] Failed to track usage:', error);
  }
};
