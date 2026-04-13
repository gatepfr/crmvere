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
    const { type, prompt, history } = req.body;

    if (!tenantId) return res.status(403).json({ error: 'No tenant context' });

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let systemPrompt = '';
    
    if (type === 'lei') {
      systemPrompt = `Você é um consultor jurídico legislativo especialista em direito municipal brasileiro. 
      Sua tarefa é redigir a estrutura de um Projeto de Lei com base no tema fornecido.
      Inclua: Título, Ementa, Artigos detalhados e uma Justificativa política e social robusta.
      ESTILO DE FORMATAÇÃO: 
      - Use uma linguagem formal e técnica.
      - NÃO use negritos (**) em excesso. Use apenas para o Título e para identificar os Artigos (ex: Art. 1º).
      - Não use blocos de código markdown.
      - Se houver histórico de conversa, mantenha a coerência com o que foi discutido anteriormente.`;
    } else if (type === 'reels') {
      systemPrompt = `Você é um estrategista de marketing político digital especialista em vídeos curtos (Reels/TikTok).
      Crie um roteiro dinâmico para o vereador. 
      Inclua: Gancho inicial (primeiros 3 segundos), desenvolvimento com falas sugeridas e indicações de cenas/cortes, e uma chamada para ação (CTA) forte ao final.
      ESTILO DE FORMATAÇÃO:
      - Tom carismático, direto e autêntico.
      - NÃO use negritos (**) no meio das frases. Use apenas para cabeçalhos de seções (ex: CENA 1, FALA).
      - Evite símbolos desnecessários.`;
    } else if (type === 'social') {
      systemPrompt = `Você é um social media manager de gabinete parlamentar.
      Transforme o relato de uma ação ou demanda resolvida em um post engajador para Instagram/Facebook.
      ESTILO DE FORMATAÇÃO:
      - Use emojis de forma moderada e parágrafos curtos.
      - NÃO use negritos (**) no texto principal do post, pois as redes sociais não renderizam markdown adequadamente.
      - Use apenas texto limpo.
      - Sugira 5 hashtags relevantes ao final.`;
    }

    // Incorporate history into the prompt if present
    let finalPrompt = prompt;
    if (history && Array.isArray(history) && history.length > 0) {
      const historyText = history.map((m: any) => `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`).join('\n');
      finalPrompt = `Histórico da conversa:\n${historyText}\n\nNova solicitação do Usuário: ${prompt}`;
    }

    const aiResult = await processDemand(finalPrompt, {
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
