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
import { authenticate } from './middleware/auth';
import { checkTenant } from './middleware/tenant';
import { checkSubscription } from './middleware/subscription';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Webhook routes (MUST be before express.json() for Stripe signature verification)
app.use('/api/webhook', webhookRoutes);

app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (Require authentication)
app.use(authenticate);

// Billing routes should skip subscription check
app.use('/api/billing', billingRoutes);

// Other protected routes require subscription check
app.use(checkSubscription);

// Super admin routes do not require tenant context
app.use('/api/superadmin', superAdminRoutes);

// Tenant-specific routes (Require tenant context)
app.use(checkTenant);

app.use('/api/demands', demandRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/ai', aiRoutes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
