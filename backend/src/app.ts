import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

// 2. AUTH (Public)
app.use('/api/auth', authRoutes);

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
