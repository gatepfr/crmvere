import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import crypto from 'crypto';
import redisClient from '../services/redisService';

const router = Router();

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

function getConfig() {
  return {
    META_APP_ID: process.env.META_APP_ID!,
    META_APP_SECRET: process.env.META_APP_SECRET!,
    REDIRECT_URI: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/instagram/oauth/callback`,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  };
}

// PUBLIC — Meta redirects here after user authorizes
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { META_APP_ID, META_APP_SECRET, REDIRECT_URI, FRONTEND_URL } = getConfig();

  // Fix 3: Safe query param coercion
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const error = typeof req.query.error === 'string' ? req.query.error : null;

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=cancelado`);
  }

  // Fix 1: Validate CSRF nonce from Redis
  const tenantId = await redisClient.get(`ig_oauth_nonce:${state}`);
  if (!tenantId) {
    return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=cancelado`);
  }
  await redisClient.del(`ig_oauth_nonce:${state}`);

  try {
    const shortRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: { client_id: META_APP_ID, client_secret: META_APP_SECRET, redirect_uri: REDIRECT_URI, code },
    });
    const shortLivedToken: string = shortRes.data.access_token;

    const longRes = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: META_APP_ID, client_secret: META_APP_SECRET, fb_exchange_token: shortLivedToken },
    });
    const longLivedToken: string = longRes.data.access_token;

    const pagesRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
      params: { access_token: longLivedToken },
    });
    const pages: Array<{ id: string; access_token: string }> = pagesRes.data.data;

    // Fix 7: Guard for empty pages array
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=sem_conta_instagram`);
    }

    let pageToken: string | null = null;
    let igAccountId: string | null = null;
    let pageId: string | null = null;

    for (const page of pages) {
      const pageRes = await axios.get(`${GRAPH_URL}/${page.id}`, {
        params: { fields: 'instagram_business_account', access_token: longLivedToken },
      });
      if (pageRes.data.instagram_business_account) {
        pageToken = page.access_token;
        igAccountId = pageRes.data.instagram_business_account.id;
        pageId = page.id;
        break;
      }
    }

    if (!pageToken || !igAccountId || !pageId) {
      return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=sem_conta_instagram`);
    }

    // Get current tenant data to check if verify token is already set
    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));

    await db.update(tenants)
      .set({ 
        instagramAccessToken: pageToken, 
        instagramAccountId: igAccountId, 
        instagramPageId: pageId,
        // Auto-configure basic settings on first connection
        instagramBotEnabled: true,
        instagramDmAiEnabled: existingTenant?.instagramDmAiEnabled ?? true,
        instagramAutoCreateMunicipe: existingTenant?.instagramAutoCreateMunicipe ?? true,
        instagramWebhookVerifyToken: existingTenant?.instagramWebhookVerifyToken || `ig_${crypto.randomBytes(16).toString('hex')}`
      })
      .where(eq(tenants.id, tenantId));

    // Auto-subscribe page to webhook events so the gabinete doesn't need to configure Meta manually
    try {
      await axios.post(`${GRAPH_URL}/${pageId}/subscribed_apps`, null, {
        params: { subscribed_fields: 'messages,feed,mention', access_token: pageToken },
      });
    } catch (subErr: any) {
      console.warn('[INSTAGRAM] Auto-subscribe webhook failed (non-fatal):', subErr?.response?.data ?? subErr?.message);
    }

    res.redirect(`${FRONTEND_URL}/dashboard/instagram?connected=true`);
  } catch (err: unknown) {
    // Fix 5: Log Graph API error detail
    const axiosErr = err as any;
    console.error('[INSTAGRAM OAUTH CALLBACK ERROR]', axiosErr?.message, axiosErr?.response?.data);
    res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=falha_meta`);
  }
});

// ALL ROUTES BELOW REQUIRE AUTH
router.use(authenticate);

router.get('/oauth/start', async (req: Request, res: Response) => {
  const { META_APP_ID, REDIRECT_URI } = getConfig();
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  // Fix 1: Generate CSRF nonce and store in Redis with 10-minute TTL
  const nonce = crypto.randomBytes(32).toString('hex');
  await redisClient.set(`ig_oauth_nonce:${nonce}`, tenantId, 'EX', 600);

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', META_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'instagram_basic,instagram_manage_messages,pages_read_engagement,instagram_manage_comments');
  url.searchParams.set('state', nonce);
  url.searchParams.set('response_type', 'code');

  res.json({ url: url.toString() });
});

// Fix 4: Wrap disconnect in try/catch
router.post('/oauth/disconnect', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  try {
    await db.update(tenants)
      .set({ 
        instagramAccessToken: null, 
        instagramAccountId: null, 
        instagramPageId: null 
      })
      .where(eq(tenants.id, tenantId));
    res.json({ success: true });
  } catch (err: unknown) {
    console.error('[INSTAGRAM DISCONNECT ERROR]', err);
    res.status(500).json({ error: 'Falha ao desconectar.' });
  }
});

export default router;
