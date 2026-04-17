import { describe, it, expect, vi } from 'vitest';
import { login } from '../authController';
import { db } from '../../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

vi.mock('../../db');
vi.mock('bcryptjs');
vi.mock('jsonwebtoken');

describe('authController - login', () => {
  it('should return 401 if user not found', async () => {
    const req = { body: { email: 'notfound@example.com', password: 'password' } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([])
      })
    });

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });
});
