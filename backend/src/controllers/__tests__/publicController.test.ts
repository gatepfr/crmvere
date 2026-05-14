// backend/src/controllers/__tests__/publicController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantPublicInfo, submitPublicDemand } from '../publicController';
import { db } from '../../db';

vi.mock('../../db');
vi.mock('../../services/evolutionService', () => ({
  EvolutionService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue({}),
  })),
}));
vi.mock('../../utils/phoneUtils', () => ({
  normalizePhone: vi.fn((p: string) => p),
}));
vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

/** Build a chained select mock that returns `rows` when `.where()` is called */
const selectReturning = (rows: any[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue(rows),
    orderBy: vi.fn().mockReturnValue(rows),
  }),
});

describe('getTenantPublicInfo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 404 para slug inexistente', async () => {
    (db.select as any).mockReturnValue(selectReturning([]));
    const req = { params: { slug: 'inexistente' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 404 para tenant bloqueado', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([
          { id: 'uuid-1', name: 'Vereador X', active: true, blocked: true },
        ]),
        orderBy: vi.fn().mockReturnValue([]),
      }),
    });
    const req = { params: { slug: 'bloqueado' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('submitPublicDemand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 quando campos obrigatórios faltam', async () => {
    const req = {
      params: { slug: 'valdirsanta' },
      // falta telefone
      body: { categoriaId: 'cat-1', descricao: 'Buraco na rua', nome: 'João' },
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('retorna 400 quando descrição é curta demais', async () => {
    const req = {
      params: { slug: 'valdirsanta' },
      body: { categoriaId: 'cat-1', descricao: 'Curto', nome: 'João', telefone: '43999990000' },
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 404 quando tenant não existe', async () => {
    (db.select as any).mockReturnValue(selectReturning([]));
    const req = {
      params: { slug: 'naoexiste' },
      body: {
        categoriaId: 'cat-1',
        descricao: 'Descrição longa o suficiente',
        nome: 'João',
        telefone: '43999990000',
      },
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
