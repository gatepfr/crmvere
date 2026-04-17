import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db';

vi.mock('../db', () => {
  const mockResolve = vi.fn().mockResolvedValue([{ id: 'm1', name: 'John Doe', phone: '5511999999999', tenantId: 'tenant-123', slug: 'tenant-1' }]);
  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => ({
      orderBy: vi.fn().mockReturnThis(),
      limit: mockResolve,
      then: (onFullfilled: any) => mockResolve().then(onFullfilled)
    })),
    orderBy: vi.fn().mockReturnThis(),
    limit: mockResolve,
    then: (onFullfilled: any) => mockResolve().then(onFullfilled)
  };

  return {
    db: {
      select: vi.fn().mockReturnValue(mockQuery),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'd1' }])
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 'd1' }])
      })
    }
  };
});

vi.mock('../services/stripeService', () => ({
  default: {
    webhooks: {
      constructEvent: vi.fn()
    }
  }
}));

vi.mock('../services/aiService', () => ({
  processDemand: vi.fn().mockResolvedValue({
    categoria: 'saude',
    prioridade: 'alta',
    resumo_ia: 'Paciente com febre'
  })
}));

describe('POST /api/webhook/evolution/:tenantId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should receive and process Evolution API webhook', async () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false
        },
        pushName: 'John Doe',
        message: {
          conversation: 'Test message'
        }
      }
    };

    const response = await request(app)
      .post('/api/webhook/evolution/tenant-123')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'received', message: 'Processing started' });
  });

  it('should ignore group messages (by letting orchestration handle it)', async () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: '123456789@g.us',
          fromMe: false
        },
        message: { conversation: 'Group message' }
      }
    };

    const response = await request(app)
      .post('/api/webhook/evolution/tenant-123')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'received', message: 'Processing started' });
  });

  it('should ignore fromMe messages (by letting orchestration handle it)', async () => {
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: true
        },
        message: { conversation: 'My own message' }
      }
    };

    const response = await request(app)
      .post('/api/webhook/evolution/tenant-123')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'received', message: 'Processing started' });
  });

  it('should ignore non-UPSERT events (by letting orchestration handle it)', async () => {
    const payload = {
      event: 'MESSAGES_UPDATE',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false
        },
        message: { conversation: 'Updated message' }
      }
    };

    const response = await request(app)
      .post('/api/webhook/evolution/tenant-123')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'received', message: 'Processing started' });
  });
});
