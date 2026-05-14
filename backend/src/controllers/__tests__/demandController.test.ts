// backend/src/controllers/__tests__/demandController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDemands } from '../demandController';
import { db } from '../../db';

vi.mock('../../db');

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('listDemands', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 403 sem tenantId', async () => {
    const req = { user: {}, query: {} } as any;
    const res = mockRes();
    await listDemands(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna dados paginados com filtro de origem', async () => {
    let call = 0;
    (db.select as any).mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: '3' }]),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    });

    const req = {
      user: { tenantId: 'tenant-uuid-1' },
      query: { origem: 'formulario_publico', page: '1', limit: '25' },
    } as any;
    const res = mockRes();
    await listDemands(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ total: 3, page: 1 }),
      })
    );
  });

  it('retorna dados paginados com filtro de data', async () => {
    let call = 0;
    (db.select as any).mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: '1' }]),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    });

    const req = {
      user: { tenantId: 'tenant-uuid-1' },
      query: { dateFrom: '2026-01-01', dateTo: '2026-01-31', page: '1', limit: '25' },
    } as any;
    const res = mockRes();
    await listDemands(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ total: 1 }),
      })
    );
  });
});
