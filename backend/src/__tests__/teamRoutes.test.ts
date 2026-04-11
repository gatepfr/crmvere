import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Team Routes', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const token = jwt.sign({ id: mockUserId, tenantId: mockTenantId, role: 'admin' }, process.env.JWT_SECRET || 'secret');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/team', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await request(app).get('/api/team');
      expect(response.status).toBe(401);
    });

    it('should return list of team members', async () => {
      const mockMembers = [
        { id: '1', email: 'admin@test.com', role: 'admin', createdAt: new Date() },
        { id: '2', email: 'assessor@test.com', role: 'assessor', createdAt: new Date() },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockMembers),
        }),
      });

      const response = await request(app)
        .get('/api/team')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].email).toBe('admin@test.com');
    });
  });

  describe('POST /api/team', () => {
    it('should create a new assessor', async () => {
      const newUser = { id: '3', email: 'new@test.com', role: 'assessor', tenantId: mockTenantId };
      
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newUser]),
        }),
      });

      const response = await request(app)
        .post('/api/team')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com' });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe('new@test.com');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 403 if user is assessor', async () => {
      const assessorToken = jwt.sign({ id: 'assessor-123', tenantId: mockTenantId, role: 'assessor' }, process.env.JWT_SECRET || 'secret');
      
      const response = await request(app)
        .post('/api/team')
        .set('Authorization', `Bearer ${assessorToken}`)
        .send({ email: 'new@test.com' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/team/:id', () => {
    it('should delete a member', async () => {
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });

      const response = await request(app)
        .delete('/api/team/member-to-delete')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow deleting self', async () => {
      const response = await request(app)
        .delete(`/api/team/${mockUserId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot delete yourself');
    });

    it('should return 403 if user is assessor', async () => {
      const assessorToken = jwt.sign({ id: 'assessor-123', tenantId: mockTenantId, role: 'assessor' }, process.env.JWT_SECRET || 'secret');
      
      const response = await request(app)
        .delete('/api/team/member-to-delete')
        .set('Authorization', `Bearer ${assessorToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Only admins can remove members');
    });
  });
});
