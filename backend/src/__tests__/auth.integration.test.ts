import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db';

vi.mock('../db');

describe('POST /api/auth/login', () => {
  it('should return 401 for invalid credentials', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([])
      })
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'password' });

    expect(res.status).toBe(401);
  });
});
