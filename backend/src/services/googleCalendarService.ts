import { google } from 'googleapis';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(tenantId: string): string {
  const oauth2Client = createOAuth2Client();
  const state = Buffer.from(tenantId).toString('base64');
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state,
  });
}

export async function exchangeCodeAndSave(code: string, state: string): Promise<void> {
  const tenantId = Buffer.from(state, 'base64').toString('utf-8');
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) throw new Error('No refresh token returned');
  await db.update(tenants)
    .set({ googleRefreshToken: tokens.refresh_token })
    .where(eq(tenants.id, tenantId));
}

async function getAuthorizedClient(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant?.googleRefreshToken) throw new Error('Google Calendar not connected');
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: tenant.googleRefreshToken });
  return { oauth2Client, calendarId: tenant.googleCalendarId ?? 'primary' };
}

export async function listEvents(tenantId: string, timeMin: string, timeMax: string) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  return res.data.items ?? [];
}

export async function createEvent(tenantId: string, event: {
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
}) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const body = event.allDay
    ? {
        summary: event.title,
        description: event.description,
        start: { date: event.start.split('T')[0] },
        end: { date: event.end.split('T')[0] },
      }
    : {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: event.end, timeZone: 'America/Sao_Paulo' },
      };
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data;
}

export async function updateEvent(tenantId: string, eventId: string, event: {
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
}) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const body = event.allDay
    ? {
        summary: event.title,
        description: event.description,
        start: { date: event.start.split('T')[0] },
        end: { date: event.end.split('T')[0] },
      }
    : {
        summary: event.title,
        description: event.description,
        start: { dateTime: event.start, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: event.end, timeZone: 'America/Sao_Paulo' },
      };
  const res = await calendar.events.update({ calendarId, eventId, requestBody: body });
  return res.data;
}

export async function deleteEvent(tenantId: string, eventId: string) {
  const { oauth2Client, calendarId } = await getAuthorizedClient(tenantId);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  await calendar.events.delete({ calendarId, eventId });
}

export async function disconnectCalendar(tenantId: string) {
  await db.update(tenants)
    .set({ googleRefreshToken: null, googleCalendarId: 'primary' })
    .where(eq(tenants.id, tenantId));
}
