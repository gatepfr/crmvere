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

/** Build a chained select mock that returns `rows` at the end of the chain */
const selectChain = (rows: any[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue(rows),
    }),
    orderBy: vi.fn().mockReturnValue(rows),
  }),
});

/** Build a chained select mock that returns `rows` directly from `.where()` */
const selectChainWhere = (rows: any[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue(rows),
    orderBy: vi.fn().mockReturnValue(rows),
  }),
});

describe('getTenantPublicInfo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 404 para slug inexistente', async () => {
    (db.select as any).mockReturnValue(selectChainWhere([]));
    const req = { params: { slug: 'inexistente' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 404 para tenant bloqueado', async () => {
    (db.select as any).mockReturnValue(
      selectChainWhere([{ id: 'uuid-1', name: 'Vereador X', active: true, blocked: true }]),
    );
    const req = { params: { slug: 'bloqueado' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 200 com informações do tenant e categorias', async () => {
    const tenant = {
      id: 'uuid-1',
      name: 'Vereador X',
      municipio: 'Londrina',
      uf: 'PR',
      partido: 'PT',
      mandato: '2021-2024',
      fotoUrl: null,
      active: true,
      blocked: false,
    };
    const categories = [{ id: 'cat-1', name: 'Infraestrutura', icon: '🏗️', color: '#000' }];

    // First call: tenant lookup (.where() returns array)
    // Second call: tenantCats (.where().orderBy() returns array)
    (db.select as any)
      .mockReturnValueOnce(selectChainWhere([tenant]))
      .mockReturnValueOnce(selectChain(categories));

    const req = { params: { slug: 'vereador-x' } } as any;
    const res = mockRes();
    await getTenantPublicInfo(req, res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Vereador X',
        categories: expect.arrayContaining([
          expect.objectContaining({ name: 'Infraestrutura' }),
        ]),
      }),
    );
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
    (db.select as any).mockReturnValue(selectChainWhere([]));
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

  it('retorna 201 com protocolo quando demanda é criada com sucesso', async () => {
    const tenant = {
      id: 'tenant-uuid',
      name: 'Vereador X',
      active: true,
      blocked: false,
      whatsappInstanceId: null,
      evolutionApiUrl: null,
      evolutionGlobalToken: null,
      whatsappNotificationNumber: null,
    };

    // Sequence of db.select calls:
    // 1. tenant lookup
    // 2. tenantCat lookup (category found)
    // 3. existing municipe lookup (not found → new municipe)
    (db.select as any)
      .mockReturnValueOnce(selectChainWhere([tenant]))
      .mockReturnValueOnce(selectChainWhere([{ name: 'Infraestrutura' }]))
      .mockReturnValueOnce(selectChainWhere([]));

    // db.execute: protocol query
    (db.execute as any).mockResolvedValueOnce({ rows: [{ nextval: '1' }] });

    // db.insert calls:
    // 1. insert municipe with .returning()
    // 2. insert demanda (no .returning())
    const insertMunicipeChain = {
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'municipe-uuid' }]),
      }),
    };
    const insertDemandaChain = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    (db.insert as any)
      .mockReturnValueOnce(insertMunicipeChain)
      .mockReturnValueOnce(insertDemandaChain);

    const req = {
      params: { slug: 'vereador-x' },
      body: {
        categoriaId: 'cat-1',
        descricao: 'Buraco na rua que precisa de reparo urgente',
        nome: 'João Silva',
        telefone: '43999990000',
        localizacao: 'Rua das Flores, 123',
      },
      file: undefined,
    } as any;
    const res = mockRes();
    await submitPublicDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolo: expect.stringMatching(/^\d{4}-\d{4}$/),
        message: 'Demanda recebida com sucesso!',
      }),
    );
  });
});
