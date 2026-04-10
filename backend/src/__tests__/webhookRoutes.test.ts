import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('POST /api/webhook/evolution/:tenantId', () => {
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
