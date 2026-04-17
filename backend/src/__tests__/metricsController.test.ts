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
    const mockTenant = [{ dailyTokenLimit: 1000, tokenUsageTotal: 100 }];
    const mockSummary = [{ total: 10, pending: 3 }];
    const mockAtendimento = [{ needsAttention: 2 }];
    const mockMunicipe = [{ total: 50, birthdaysToday: 1, uniqueBairros: 5 }];
    const mockCategoryStats = [{ name: 'saude', value: 7 }, { name: 'educacao', value: 3 }];
    const mockDailyStats = [
      { date: '10/04', count: 5, day: '2024-04-10' },
      { date: '09/04', count: 5, day: '2024-04-09' }
    ];

    // Fluent mock for Drizzle
    const createChain = (value: any) => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((onFulfilled) => Promise.resolve(value).then(onFulfilled)),
      // For [destructuring] = await db.select()...
      [Symbol.iterator]: function* () { yield value[0]; }
    });

    (db.select as any)
      .mockReturnValueOnce(createChain(mockTenant))
      .mockReturnValueOnce(createChain(mockSummary))
      .mockReturnValueOnce(createChain(mockAtendimento))
      .mockReturnValueOnce(createChain(mockMunicipe))
      .mockReturnValueOnce(createChain(mockCategoryStats))
      .mockReturnValueOnce(createChain(mockDailyStats));

    await getDashboardStats(req, res);

    expect(res.json).toHaveBeenCalledWith({
      summary: { 
        total: 10, 
        pending: 3,
        needsAttention: 2,
        municipesTotal: 50,
        birthdaysToday: 1,
        uniqueBairros: 5,
        dailyTokenLimit: 1000,
        tokenUsageTotal: 100
      },
      categoryStats: mockCategoryStats,
      dailyStats: [
        { date: '10/04', count: 5 },
        { date: '09/04', count: 5 }
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
