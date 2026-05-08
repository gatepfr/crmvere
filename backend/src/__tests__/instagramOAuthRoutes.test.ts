import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

vi.mock('../db', () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('axios');
import axios from 'axios';

const mockAxiosGet = vi.mocked(axios.get);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = 'test_app_id';
  process.env.META_APP_SECRET = 'test_app_secret';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.BACKEND_URL = 'http://localhost:3001';
});

describe('GET /api/instagram/oauth/start', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/instagram/oauth/start');
    expect(res.status).toBe(401);
  });

  it('returns Meta authorization URL with tenantId as state', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      process.env.JWT_SECRET || 'supersecret'
    );

    const res = await request(app)
      .get('/api/instagram/oauth/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('facebook.com/v21.0/dialog/oauth');
    expect(res.body.url).toContain('state=tenant-123');
    expect(res.body.url).toContain('client_id=test_app_id');
  });
});

describe('GET /api/instagram/oauth/callback', () => {
  it('redirects with ?error=cancelado when no code', async () => {
    const res = await request(app).get('/api/instagram/oauth/callback?state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?error=cancelado when Meta returns error', async () => {
    const res = await request(app).get('/api/instagram/oauth/callback?error=access_denied&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?connected=true on success', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } } as any)
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'page1', access_token: 'page_token' }] } } as any)
      .mockResolvedValueOnce({ data: { instagram_business_account: { id: 'ig123' }, access_token: 'page_token' } } as any);

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('connected=true');
  });

  it('redirects with ?error=sem_conta_instagram when no Instagram Business Account found', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } } as any)
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'page1', access_token: 'page_token' }] } } as any)
      .mockResolvedValueOnce({ data: { access_token: 'page_token' } } as any);

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=sem_conta_instagram');
  });

  it('redirects with ?error=falha_meta on Graph API error', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('Graph API error'));

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=tenant-123');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=falha_meta');
  });
});

describe('POST /api/instagram/oauth/disconnect', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/instagram/oauth/disconnect');
    expect(res.status).toBe(401);
  });

  it('clears token and accountId, returns success', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      process.env.JWT_SECRET || 'supersecret'
    );

    const { db } = await import('../db');
    const res = await request(app)
      .post('/api/instagram/oauth/disconnect')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(db.update)).toHaveBeenCalled();
  });
});
