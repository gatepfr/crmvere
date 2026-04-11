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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/demands', demandRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/map', mapRoutes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
