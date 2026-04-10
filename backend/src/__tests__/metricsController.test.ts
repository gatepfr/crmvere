import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMetrics } from '../controllers/metricsController';
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

  it('should return metrics for the tenant', async () => {
    const mockTotal = [{ count: 10 }];
    const mockByStatus = [{ status: 'nova', count: 5 }, { status: 'concluida', count: 5 }];
    const mockByCategory = [{ categoria: 'saude', count: 7 }, { categoria: 'educacao', count: 3 }];

    // Fluent mock for Drizzle
    const chainTotal = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockTotal),
    };
    
    const chainStatus = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(mockByStatus),
    };

    const chainCategory = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue(mockByCategory),
    };

    (db.select as any)
      .mockReturnValueOnce(chainTotal)
      .mockReturnValueOnce(chainStatus)
      .mockReturnValueOnce(chainCategory);

    await getMetrics(req, res);

    expect(res.json).toHaveBeenCalledWith({
      total: 10,
      byStatus: mockByStatus,
      byCategory: mockByCategory,
    });
  });

  it('should return 403 if tenantId is missing', async () => {
    req.user.tenantId = undefined;
    await getMetrics(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenant context' });
  });
});
