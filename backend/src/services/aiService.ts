import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface AIDemandResult {
  categoria: 'saude' | 'infraestrutura' | 'seguranca' | 'educacao' | 'outro';
  subcategoria: string;
  resumo_ia: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  acao_sugerida: string;
  precisa_retorno: boolean;
  resposta_usuario: string; // Resposta direta para enviar ao cidadão
}

export interface AIConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'custom' | 'openrouter';
  apiKey: string;
  model: string;
  aiBaseUrl?: string; // Optional custom endpoint (Ollama, OpenRouter, etc)
  systemPrompt: string;
}

/**
 * Factory para processar demandas usando diferentes provedores de IA.
 */
export async function processDemand(
  messageText: string, 
  config: AIConfig,
  context?: string,
  knowledgeBaseContent?: string
): Promise<AIDemandResult> {
  
  const systemPersonality = config.systemPrompt || 'Você é um assistente de IA para um vereador. Sua tarefa é analisar a mensagem de um cidadão e extrair informações úteis para o gabinete.';

  const prompt = `
    INSTRUÇÃO DE IDENTIDADE (PRIORIDADE MÁXIMA):
    ${systemPersonality}
    
    INSTRUÇÕES DE EXECUÇÃO:
    1. Você deve agir SEMPRE de acordo com sua IDENTIDADE acima. Se você tem um nome, use-o quando apropriado.
    2. Abaixo está o HISTÓRICO da conversa e a MENSAGEM ATUAL do cidadão.
    3. Analise o contexto completo para não ser repetitivo.
    4. Responda ao cidadão de forma natural e humana no campo "resposta_usuario".
    5. Extraia os dados técnicos (categoria, prioridade, etc) para controle interno do gabinete.

    BASE DE CONHECIMENTO DO GABINETE:
    ${knowledgeBaseContent || 'Nenhuma informação adicional disponível.'}

    HISTÓRICO E MENSAGEM DO CIDADÃO:
    ${messageText}

    Responda EXCLUSIVAMENTE com um objeto JSON no formato abaixo, envolto pelos delimitadores |||JSON|||.

    |||JSON|||
    {
      "categoria": "saude" | "infraestrutura" | "seguranca" | "educacao" | "outro",
      "subcategoria": "2 ou 3 palavras sobre o tema",
      "resumo_ia": "Um resumo detalhado e organizado. Use tópicos (•) e negrito (**) para destacar pontos chave como: **Assunto**, **Localização**, **Urgência**.",
      "prioridade": "baixa" | "media" | "alta" | "urgente",
      "acao_sugerida": "ação recomendada para o gabinete",
      "precisa_retorno": true | false,
      "resposta_usuario": "Sua resposta direta, gentil e personalizada ao cidadão."
    }
    |||JSON|||
  `;

  let responseText = "";

  try {
    console.log(`[AI SERVICE] Using provider: ${config.provider}, model: ${config.model}`);
    switch (config.provider) {
      case 'openrouter': {
        const openai = new OpenAI({ 
          apiKey: config.apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://gabinetedigital.com",
            "X-Title": "Gabinete Digital",
          }
        });
        
        try {
          const completion = await openai.chat.completions.create({
            model: config.model || "meta-llama/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
          });
          responseText = completion.choices[0]?.message.content || "";
        } catch (err: any) {
          console.error(`[AI SERVICE] OpenRouter primary model failed: ${err.message}. Trying fallback...`);
          // Fallback to a very stable and cheap model
          const fallback = await openai.chat.completions.create({
            model: "meta-llama/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
          });
          responseText = fallback.choices[0]?.message.content || "";
        }
        break;
      }

      case 'custom':
      case 'openai': {
        const openai = new OpenAI({ 
          apiKey: config.apiKey,
          baseURL: config.aiBaseUrl || undefined
        });
        const completion = await openai.chat.completions.create({
          model: config.model || "gpt-4o",
          messages: [{ role: "user", content: prompt }],
        });
        responseText = completion.choices[0]?.message.content || "";
        break;
      }

      case 'anthropic': {
        const anthropic = new Anthropic({ apiKey: config.apiKey });
        const msg = await anthropic.messages.create({
          model: config.model || "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });
        responseText = (msg.content[0] as any).text || "";
        break;
      }

      case 'groq': {
        const groq = new OpenAI({ 
          apiKey: config.apiKey,
          baseURL: config.aiBaseUrl || "https://api.groq.com/openai/v1" 
        });
        const completion = await groq.chat.completions.create({
          model: config.model || "llama3-70b-8192",
          messages: [{ role: "user", content: prompt }],
        });
        responseText = completion.choices[0]?.message.content || "";
        break;
      }

      case 'gemini':
      default: {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model || "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        responseText = response.text();
        break;
      }
    }

    console.log(`[AI SERVICE] Response received (length: ${responseText.length})`);


    const jsonMatch = responseText.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|JSON\|\|\|/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error("Falha ao processar resposta da IA: Formato inválido");
    }

    const cleanJson = jsonMatch[1].trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error(`Erro ao processar demanda com IA (${config.provider}):`, error);
    throw error;
  }
}
