import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';

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
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=cancelado`);
  }

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

    let pageToken: string | null = null;
    let igAccountId: string | null = null;

    for (const page of pages) {
      const pageRes = await axios.get(`${GRAPH_URL}/${page.id}`, {
        params: { fields: 'instagram_business_account,access_token', access_token: longLivedToken },
      });
      if (pageRes.data.instagram_business_account) {
        pageToken = pageRes.data.access_token;
        igAccountId = pageRes.data.instagram_business_account.id;
        break;
      }
    }

    if (!pageToken || !igAccountId) {
      return res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=sem_conta_instagram`);
    }

    await db.update(tenants)
      .set({ instagramAccessToken: pageToken, instagramAccountId: igAccountId })
      .where(eq(tenants.id, state));

    res.redirect(`${FRONTEND_URL}/dashboard/instagram?connected=true`);
  } catch (err: any) {
    console.error('[INSTAGRAM OAUTH CALLBACK ERROR]', err.message);
    res.redirect(`${FRONTEND_URL}/dashboard/instagram?error=falha_meta`);
  }
});

// ALL ROUTES BELOW REQUIRE AUTH
router.use(authenticate);

router.get('/oauth/start', (req: Request, res: Response) => {
  const { META_APP_ID, REDIRECT_URI } = getConfig();
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', META_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'instagram_basic,instagram_manage_messages,pages_messaging,pages_read_engagement,instagram_manage_comments');
  url.searchParams.set('state', tenantId);
  url.searchParams.set('response_type', 'code');

  res.json({ url: url.toString() });
});

router.post('/oauth/disconnect', async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Sessão inválida' });

  await db.update(tenants)
    .set({ instagramAccessToken: null, instagramAccountId: null })
    .where(eq(tenants.id, tenantId));

  res.json({ success: true });
});

export default router;
