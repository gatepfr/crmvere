import { Router } from 'express';
import { db } from '../db';
import { tenants } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { processDemand } from '../services/aiService';

const router = Router();
router.use(authenticate);

router.post('/generate-content', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { type, prompt } = req.body;

    if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let systemPrompt = '';
    
    if (type === 'lei') {
      systemPrompt = `Você é um consultor jurídico legislativo especialista em direito municipal brasileiro. 
      Sua tarefa é redigir a estrutura de um Projeto de Lei com base no tema fornecido.
      Inclua: Título, Ementa, Artigos detalhados e uma Justificativa política e social robusta.
      Use uma linguagem formal e técnica.`;
    } else if (type === 'reels') {
      systemPrompt = `Você é um estrategista de marketing político digital especialista em vídeos curtos (Reels/TikTok).
      Crie um roteiro dinâmico para o vereador. 
      Inclua: Gancho inicial (primeiros 3 segundos), desenvolvimento com falas sugeridas e indicações de cenas/cortes, e uma chamada para ação (CTA) forte ao final.
      O tom deve ser carismático, direto e autêntico.`;
    } else if (type === 'social') {
      systemPrompt = `Você é um social media manager de gabinete parlamentar.
      Transforme o relato de uma ação ou demanda resolvida em um post engajador para Instagram/Facebook.
      Use emojis, parágrafos curtos e foque nos benefícios para a comunidade.
      Sugira 5 hashtags relevantes ao final.`;
    }

    const aiResult = await processDemand(prompt, {
      provider: tenant.aiProvider as any || 'gemini',
      apiKey: tenant.aiApiKey || '',
      model: tenant.aiModel || 'gemini-1.5-flash',
      aiBaseUrl: tenant.aiBaseUrl || undefined,
      systemPrompt: systemPrompt
    });

    res.json({ text: aiResult.resposta_usuario });
  } catch (error: any) {
    console.error('Error in AI Lab:', error.message);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

export default router;
