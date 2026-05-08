import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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

// Use vi.hoisted so these are available inside the hoisted vi.mock factory
const { mockRedisGet, mockRedisSet, mockRedisDel } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}));

vi.mock('../services/redisService', () => ({
  default: {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    on: vi.fn(),
  },
  redisService: {},
}));

const mockAxiosGet = vi.mocked(axios.get);

const TEST_SECRET = 'test-secret';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = 'test_app_id';
  process.env.META_APP_SECRET = 'test_app_secret';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.BACKEND_URL = 'http://localhost:3001';
  process.env.JWT_SECRET = TEST_SECRET;

  // Default Redis mock behaviour
  mockRedisSet.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  mockRedisGet.mockResolvedValue(null);
});

describe('GET /api/instagram/oauth/start', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/instagram/oauth/start');
    expect(res.status).toBe(401);
  });

  it('returns Meta authorization URL with nonce as state (not tenantId)', async () => {
    const token = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      TEST_SECRET
    );

    const res = await request(app)
      .get('/api/instagram/oauth/start')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('facebook.com/v21.0/dialog/oauth');
    expect(res.body.url).toContain('client_id=test_app_id');
    // state should be a hex nonce (64 chars), NOT the tenantId
    const urlObj = new URL(res.body.url);
    const state = urlObj.searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(state).not.toBe('tenant-123');
    // Redis set should have been called with the nonce → tenantId mapping
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^ig_oauth_nonce:[0-9a-f]{64}$/),
      'tenant-123',
      'EX',
      600
    );
  });
});

describe('GET /api/instagram/oauth/callback', () => {
  it('redirects with ?error=cancelado when no code', async () => {
    const res = await request(app).get('/api/instagram/oauth/callback?state=some-nonce');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?error=cancelado when Meta returns error', async () => {
    const res = await request(app).get('/api/instagram/oauth/callback?error=access_denied&state=some-nonce');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?error=cancelado when nonce not found in Redis', async () => {
    mockRedisGet.mockResolvedValue(null);

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=invalid-nonce');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=cancelado');
  });

  it('redirects with ?connected=true on success', async () => {
    mockRedisGet.mockResolvedValue('tenant-123');

    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } } as any)
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'page1', access_token: 'page_token' }] } } as any)
      .mockResolvedValueOnce({ data: { instagram_business_account: { id: 'ig123' } } } as any);

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=valid-nonce');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('connected=true');
    expect(mockRedisDel).toHaveBeenCalledWith('ig_oauth_nonce:valid-nonce');
  });

  it('redirects with ?error=sem_conta_instagram when no Instagram Business Account found', async () => {
    mockRedisGet.mockResolvedValue('tenant-123');

    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } } as any)
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'page1', access_token: 'page_token' }] } } as any)
      .mockResolvedValueOnce({ data: {} } as any);

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=valid-nonce');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=sem_conta_instagram');
  });

  it('redirects with ?error=sem_conta_instagram when pages array is empty', async () => {
    mockRedisGet.mockResolvedValue('tenant-123');

    mockAxiosGet
      .mockResolvedValueOnce({ data: { access_token: 'short_token' } } as any)
      .mockResolvedValueOnce({ data: { access_token: 'long_token' } } as any)
      .mockResolvedValueOnce({ data: { data: [] } } as any);

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=valid-nonce');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=sem_conta_instagram');
  });

  it('redirects with ?error=falha_meta on Graph API error', async () => {
    mockRedisGet.mockResolvedValue('tenant-123');
    mockAxiosGet.mockRejectedValueOnce(new Error('Graph API error'));

    const res = await request(app).get('/api/instagram/oauth/callback?code=auth_code&state=valid-nonce');
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
    const token = jwt.sign(
      { tenantId: 'tenant-123', userId: 'user-1' },
      TEST_SECRET
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
