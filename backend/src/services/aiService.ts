import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface AIDemandResult {
  categoria: 'saude' | 'infraestrutura' | 'seguranca' | 'educacao' | 'funcionario_publico' | 'outro';
  subcategoria: string;
  resumo_ia: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  acao_sugerida: string;
  precisa_retorno: boolean;
  resposta_usuario: string; // Resposta direta para enviar ao cidadão
}

export interface AIResponse {
  data: AIDemandResult;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
): Promise<AIResponse> {
  
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
CATEGORIAS PERMITIDAS (USE EXATAMENTE UMA DESTAS):
SAÚDE, INFRAESTRUTURA, SEGURANÇA, EDUCAÇÃO, ESPORTE, FUNCIONÁRIO PÚBLICO, OUTRO.

BASE DE CONHECIMENTO DO GABINETE:
${knowledgeBaseContent || 'Nenhuma informação adicional disponível.'}

HISTÓRICO E MENSAGEM DO CIDADÃO:
${messageText}

Responda EXCLUSIVAMENTE com um objeto JSON válido, envolto pelos delimitadores |||JSON|||.

|||JSON|||
{
  "categoria": "NOME_DA_CATEGORIA",
  "subcategoria": "assunto resumido",
  "resumo_ia": "Resumo organizado dos pontos chave.",
  "prioridade": "baixa" | "media" | "alta" | "urgente",
  "acao_sugerida": "O que o gabinete deve fazer",
  "precisa_retorno": true | false,
  "resposta_usuario": "Sua resposta gentil ao cidadão."
}
|||JSON|||
`;

let responseText = "";
let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

try {
// ... (rest of the switch case stays the same)

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
          if (completion.usage) {
            usage = {
              prompt_tokens: completion.usage.prompt_tokens,
              completion_tokens: completion.usage.completion_tokens,
              total_tokens: completion.usage.total_tokens
            };
          }
        } catch (err: any) {
          console.error(`[AI SERVICE] OpenRouter primary model failed: ${err.message}. Trying fallback...`);
          // Fallback to a very stable and cheap model
          const fallback = await openai.chat.completions.create({
            model: "meta-llama/llama-3.1-8b-instruct",
            messages: [{ role: "user", content: prompt }],
          });
          responseText = fallback.choices[0]?.message.content || "";
          if (fallback.usage) {
            usage = {
              prompt_tokens: fallback.usage.prompt_tokens,
              completion_tokens: fallback.usage.completion_tokens,
              total_tokens: fallback.usage.total_tokens
            };
          }
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
        if (completion.usage) {
          usage = {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens
          };
        }
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
        if (msg.usage) {
          usage = {
            prompt_tokens: msg.usage.input_tokens,
            completion_tokens: msg.usage.output_tokens,
            total_tokens: msg.usage.input_tokens + msg.usage.output_tokens
          };
        }
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
        if (completion.usage) {
          usage = {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens
          };
        }
        break;
      }

      case 'gemini':
      default: {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model || "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        responseText = response.text();
        
        // Extract Gemini Usage (if available in this version of SDK)
        if (response.usageMetadata) {
          usage = {
            prompt_tokens: response.usageMetadata.promptTokenCount || 0,
            completion_tokens: response.usageMetadata.candidatesTokenCount || 0,
            total_tokens: response.usageMetadata.totalTokenCount || 0
          };
        } else {
          // Approximate for older Gemini SDK versions
          const approxTotal = Math.ceil((prompt.length + responseText.length) / 4);
          usage = { 
            prompt_tokens: Math.ceil(prompt.length / 4), 
            completion_tokens: Math.ceil(responseText.length / 4), 
            total_tokens: approxTotal 
          };
        }
        break;
      }
    }

    console.log(`[AI SERVICE] Response received (Tokens used: ${usage.total_tokens})`);

    // Extração robusta de JSON
    let cleanJson = "";
    
    // 1. Tentar delimitadores customizados |||JSON|||
    const delimiterMatch = responseText.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|JSON\|\|\|/);
    if (delimiterMatch && delimiterMatch[1]) {
      cleanJson = delimiterMatch[1].trim();
    } else {
      // 2. Tentar blocos de markdown ```json ou ```
      const markdownMatch = responseText.match(/```json([\s\S]*?)```/) || responseText.match(/```([\s\S]*?)```/);
      if (markdownMatch && markdownMatch[1]) {
        cleanJson = markdownMatch[1].trim();
      } else {
        // 3. Pegar tudo entre a primeira { e a última }
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleanJson = responseText.substring(firstBrace, lastBrace + 1).trim();
        }
      }
    }

    if (!cleanJson) {
      console.error("[AI SERVICE] Raw Response:", responseText);
      throw new Error("Falha ao extrair JSON da resposta da IA");
    }

    // LIMPEZA ADICIONAL: Remove quebras de linha literais que quebram o JSON.parse
    // Mas mantém os \n que são strings de escape.
    const sanitizeJson = (str: string) => {
      return str
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove caracteres de controle invisíveis
        .replace(/\n/g, " ") // Troca quebras de linha reais por espaços
        .replace(/\r/g, " ")
        .replace(/\t/g, " ");
    };

    try {
      // Tentativa 1: Parse direto (mais rápido)
      const parsedData = JSON.parse(cleanJson);
      if (parsedData.categoria) parsedData.categoria = parsedData.categoria.toLowerCase().replace(/ /g, '_');
      if (parsedData.prioridade) parsedData.prioridade = parsedData.prioridade.toLowerCase();
      return { data: parsedData, usage };
    } catch (parseError) {
      try {
        // Tentativa 2: Parse higienizado (para Llama/Groq)
        console.log("[AI SERVICE] Tentando parse higienizado...");
        const parsedData = JSON.parse(cleanJson.replace(/\n/g, "\\n").replace(/\r/g, ""));
        if (parsedData.categoria) parsedData.categoria = parsedData.categoria.toLowerCase().replace(/ /g, '_');
        if (parsedData.prioridade) parsedData.prioridade = parsedData.prioridade.toLowerCase();
        return { data: parsedData, usage };
      } catch (secondError) {
        console.error("[AI SERVICE] Erro persistente no JSON:", cleanJson);
        throw new Error("Falha ao processar JSON da IA: Formato inválido");
      }
    }

  } catch (error) {
    console.error(`Erro ao processar demanda com IA (${config.provider}):`, error);
    throw error;
  }
}

/**
 * Gera roteiros de marketing político (Reels/Posts) baseados no bairro e demandas locais.
 */
export async function generateStrategicContent(
  bairro: string,
  demandaPrincipal: string,
  config: AIConfig
): Promise<{ reels: string, post: string }> {
  const prompt = `
    Você é um estrategista de marketing político digital para um vereador.
    Sua tarefa é criar conteúdo para o bairro: ${bairro}.
    A principal demanda/conquista nessa região é: ${demandaPrincipal}.

    Gere:
    1. Um roteiro curto (30-60s) para um Reels/TikTok.
    2. Uma legenda para post de Instagram/WhatsApp.

    Responda em formato JSON:
    {
      "reels": "texto do roteiro",
      "post": "texto da legenda"
    }
  `;

  let responseText = "";

  try {
    if (config.provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.model || "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      responseText = response.text();
    } else {
      const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.aiBaseUrl || undefined });
      const completion = await openai.chat.completions.create({
        model: config.model || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      });
      responseText = completion.choices[0]?.message.content || "";
    }

    // Extração simples de JSON
    const firstBrace = responseText.indexOf('{');
    const lastBrace = responseText.lastIndexOf('}');
    const cleanJson = responseText.substring(firstBrace, lastBrace + 1);
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('[AI SERVICE] Error generating strategic content:', error);
    return { 
      reels: `Fale sobre as melhorias em ${bairro}.`, 
      post: `Estamos atuando firme no bairro ${bairro}!` 
    };
  }
}
