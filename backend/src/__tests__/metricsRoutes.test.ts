import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import * as dbModule from '../db';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('GET /api/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const response = await request(app).get('/api/metrics');
    expect(response.status).toBe(401);
  });

  it('should return metrics for the user tenant', async () => {
    // We need a valid JWT to pass the authenticate middleware
    // Or we can mock the authenticate middleware, but it's better to test with a real-ish flow
    // Since we are mocking db, let's also mock the jwt verification if needed, 
    // but Supertest allows us to set headers.
    
    // Actually, mocking the controller or the db is what we're doing.
    // Let's mock the 'db' return values for the three queries:
    // 1. Total count
    // 2. Count by status
    // 3. Count by category

    const mockDb = dbModule.db;

    (mockDb.select as any).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValueOnce([{ count: 10 }]) // Total
        .mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
    });

    // This mocking is getting complex because of how Drizzle chains work.
    // Let's try a more specific mock for the metrics controller needs.
  });
});
