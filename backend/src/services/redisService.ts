import Redis from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.on('connect', () => console.log('Redis connected successfully'));

export const redisService = {
  /**
   * Get current usage for a tenant on a specific date
   */
  async getUsage(tenantId: string, date: string): Promise<number> {
    const key = `usage:${tenantId}:${date}`;
    const val = await redis.get(key);
    return val ? parseInt(val) : 0;
  },

  /**
   * Increment usage for a tenant
   */
  async incrementUsage(tenantId: string, date: string, amount: number): Promise<number> {
    const key = `usage:${tenantId}:${date}`;
    const newVal = await redis.incrby(key, amount);
    // Set expiry to 48h to ensure it lasts past the current day but doesn't stay forever
    await redis.expire(key, 172800); 
    return newVal;
  },

  /**
   * Get limit for a tenant (cached)
   */
  async getLimit(tenantId: string): Promise<number | null> {
    const key = `limit:${tenantId}`;
    const val = await redis.get(key);
    return val ? parseInt(val) : null;
  },

  /**
   * Set/Cache limit for a tenant
   */
  async setLimit(tenantId: string, limit: number): Promise<void> {
    const key = `limit:${tenantId}`;
    await redis.set(key, limit.toString(), 'EX', 3600); // Cache for 1 hour
  },

  /**
   * Check if tenant is blocked (Kill Switch)
   */
  async isBlocked(tenantId: string): Promise<boolean> {
    const key = `blocked:${tenantId}`;
    const val = await redis.get(key);
    return val === 'true';
  },

  /**
   * Set Kill Switch status
   */
  async setBlockedStatus(tenantId: string, blocked: boolean): Promise<void> {
    const key = `blocked:${tenantId}`;
    if (blocked) {
      await redis.set(key, 'true');
    } else {
      await redis.del(key);
    }
  },

  /**
   * Clear all caches for a tenant (force reload from DB)
   */
  async invalidateCache(tenantId: string): Promise<void> {
    await redis.del(`limit:${tenantId}`);
    await redis.del(`blocked:${tenantId}`);
  },

  /**
   * Store WhatsApp connection status for a tenant
   * status: 'connected' | 'connecting' | 'disconnected' | 'needs_reconnect'
   */
  async setWhatsAppStatus(tenantId: string, status: string): Promise<void> {
    const key = `wa_status:${tenantId}`;
    await redis.set(key, JSON.stringify({ status, updatedAt: new Date().toISOString() }), 'EX', 604800);
  },

  /**
   * Get WhatsApp connection status for a tenant
   */
  async getWhatsAppStatus(tenantId: string): Promise<{ status: string; updatedAt: string } | null> {
    const key = `wa_status:${tenantId}`;
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  },

  /**
   * Atomic deduplication lock for incoming WhatsApp messages.
   * Returns true if this messageId is new (acquired lock), false if already processed.
   * TTL of 5 minutes is enough to absorb duplicate webhook deliveries.
   */
  async acquireMessageLock(tenantId: string, messageId: string): Promise<boolean> {
    const key = `msg_lock:${tenantId}:${messageId}`;
    const result = await redis.set(key, '1', 'EX', 300, 'NX');
    return result === 'OK';
  },
};

export default redis;
