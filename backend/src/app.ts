import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import webhookRoutes from './routes/webhookRoutes';
import demandRoutes from './routes/demandRoutes';
import metricsRoutes from './routes/metricsRoutes';
import configRoutes from './routes/configRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import knowledgeRoutes from './routes/knowledgeRoutes';
import kanbanRoutes from './routes/kanbanRoutes';
import teamRoutes from './routes/teamRoutes';
import profileRoutes from './routes/profileRoutes';
import mapRoutes from './routes/mapRoutes';
import aiRoutes from './routes/aiRoutes';
import billingRoutes from './routes/billingRoutes';
import eleicoesRoutes from './routes/eleicoesRoutes';
import intelligenceRoutes from './routes/intelligenceRoutes';
import calendarRoutes from './routes/calendarRoutes';
import broadcastRoutes from './routes/broadcastRoutes';
import reportRoutes from './routes/reportRoutes';
import documentoRoutes from './routes/documentoRoutes';
import instagramRoutes from './routes/instagramRoutes';
import instagramOAuthRoutes from './routes/instagramOAuthRoutes';
import publicRoutes from './routes/publicRoutes';
import { authenticate } from './middleware/auth';
import { initAutomations } from './services/automationService';
import { checkTenant } from './middleware/tenant';
import { checkSubscription } from './middleware/subscription';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializa Automações (Cron Jobs)
initAutomations();

app.use(cors({
  origin: '*', // Permite qualquer origem em desenvolvimento, mas o ideal é listar os domínios
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 1. WEBHOOKS (Public)
// Must be before express.json for Stripe
app.use('/api/webhook', webhookRoutes);

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 2. AUTH (Public)
app.use('/api/auth', authRoutes);

// Calendar routes (callback is public; auth applied internally after callback)
app.use('/api/calendar', calendarRoutes);

// Instagram OAuth routes (callback is public; auth applied internally after callback)
app.use('/api/instagram', instagramOAuthRoutes);

// PUBLIC ROUTES (No auth required)
app.use('/api/public', publicRoutes);

// 3. PROTECTED ROUTES (Require Login)
app.use(authenticate);

// Super Admin
app.use('/api/superadmin', superAdminRoutes);

// WhatsApp & Billing (Skip Subscription check for recovery)
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/billing', billingRoutes);

// 4. TENANT SPECIFIC ROUTES
app.use(checkSubscription);
app.use(checkTenant);

app.use('/api/demands', demandRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/eleicoes', eleicoesRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/documentos', documentoRoutes);
app.use('/api/instagram', instagramRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[GLOBAL ERROR]', err);
  res.status(err.status || 500).json({ 
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Ocorreu um erro interno no servidor.'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
