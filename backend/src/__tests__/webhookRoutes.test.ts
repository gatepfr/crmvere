import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db';

vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'm1', name: 'John Doe', phone: '5511999999999' }])
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'd1' }])
    })
  },
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
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net'
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
    expect(response.body).toEqual({ status: 'received' });
  });
});
