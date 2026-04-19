import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  getAuthUrl,
  exchangeCodeAndSave,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  disconnectCalendar,
} from '../services/googleCalendarService';

const router = Router();

// PUBLIC — Google redirects here after user authorizes
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (error || !code || !state) {
    return res.redirect(`${frontendUrl}/dashboard/agenda?google_error=access_denied`);
  }
  try {
    await exchangeCodeAndSave(code, state);
    res.redirect(`${frontendUrl}/dashboard/agenda?google_connected=true`);
  } catch (err: any) {
    console.error('[CALENDAR CALLBACK ERROR]', err.message);
    res.redirect(`${frontendUrl}/dashboard/agenda?google_error=token_exchange_failed`);
  }
});

// ALL ROUTES BELOW REQUIRE AUTH
router.use(authenticate);

router.get('/auth', (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const url = getAuthUrl(tenantId);
  res.json({ url });
});

router.get('/status', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  res.json({ connected: !!tenant?.googleRefreshToken });
});

router.delete('/disconnect', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  await disconnectCalendar(tenantId);
  res.json({ success: true });
});

router.get('/events', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  const { start, end } = req.query as { start: string; end: string };
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  try {
    const events = await listEvents(tenantId, start, end);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const event = await createEvent(tenantId, req.body);
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/events/:eventId', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    const event = await updateEvent(tenantId, req.params.eventId, req.body);
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:eventId', async (req, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'No tenant context' });
  try {
    await deleteEvent(tenantId, req.params.eventId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
