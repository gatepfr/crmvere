import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIDemandResult {
  categoria: 'saude' | 'infraestrutura' | 'seguranca' | 'educacao' | 'outro';
  subcategoria: string;
  resumo_ia: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  acao_sugerida: string;
  precisa_retorno: boolean;
}

/**
 * Analisa a mensagem do cidadão usando o Gemini AI e retorna dados estruturados.
 * @param messageText Texto da mensagem do cidadão
 * @param config Configurações do Gemini para o tenant
 * @param context Contexto adicional (ex: histórico de conversa)
 * @param knowledgeBaseContent Conteúdo extraído dos documentos da base de conhecimento
 * @returns Promessa com o resultado estruturado
 */
export async function processDemand(
  messageText: string, 
  config: { apiKey: string, model: string, systemPrompt: string },
  context?: string,
  knowledgeBaseContent?: string
): Promise<AIDemandResult> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });

  const prompt = `
    ${config.systemPrompt || 'Você é um assistente de IA para um vereador. Sua tarefa é analisar a mensagem de um cidadão e extrair informações úteis para o gabinete.'}
    
    BASE DE CONHECIMENTO (Use estas informações para contextualizar sua resposta se necessário):
    ${knowledgeBaseContent || 'Nenhuma informação adicional disponível.'}

    Contexto adicional da conversa: ${context || 'Nenhum'}
    Mensagem do cidadão: ${messageText}

    Responda EXCLUSIVAMENTE com um objeto JSON no formato abaixo, envolto pelos delimitadores |||JSON|||. Não adicione nenhum texto antes ou depois.

    |||JSON|||
    {
      "categoria": "saude" | "infraestrutura" | "seguranca" | "educacao" | "outro",
      "subcategoria": "descreva brevemente em 2 ou 3 palavras",
      "resumo_ia": "resumo conciso da solicitação",
      "prioridade": "baixa" | "media" | "alta" | "urgente",
      "acao_sugerida": "ação recomendada para o gabinete do vereador",
      "precisa_retorno": true | false
    }
    |||JSON|||
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|JSON\|\|\|/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error("Falha ao processar resposta da IA: Formato inválido");
    }

    const cleanJson = jsonMatch[1].trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Erro ao processar demanda com IA:", error);
    throw error;
  }
}
