import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardStats } from '../controllers/metricsController';
import { db } from '../db';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Metrics Controller', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: {
        id: 'u1',
        tenantId: 't1',
        role: 'admin',
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it('should return dashboard stats for the tenant', async () => {
    const mockTotal = [{ count: 10 }];
    const mockPending = [{ count: 3 }];
    const mockCategoryStats = [{ name: 'saude', value: 7 }, { name: 'educacao', value: 3 }];
    const mockDailyStats = [{ date: '10/04', count: 5 }, { date: '09/04', count: 5 }];

    // Fluent mock for Drizzle
    const chainTotal = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockTotal),
    };
    
    const chainPending = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockPending),
    };

    const chainCategory = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(mockCategoryStats),
    };

    const chainDaily = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockDailyStats),
    };

    (db.select as any)
      .mockReturnValueOnce(chainTotal)
      .mockReturnValueOnce(chainPending)
      .mockReturnValueOnce(chainCategory)
      .mockReturnValueOnce(chainDaily);

    await getDashboardStats(req, res);

    expect(res.json).toHaveBeenCalledWith({
      summary: { total: 10, pending: 3 },
      categoryStats: mockCategoryStats,
      dailyStats: [
        { date: '09/04', count: 5 },
        { date: '10/04', count: 5 }
      ],
    });
  });

  it('should return 403 if tenantId is missing', async () => {
    req.user.tenantId = undefined;
    await getDashboardStats(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenant context' });
  });
});
