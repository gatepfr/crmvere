import { vi, describe, it, expect } from 'vitest';
import { processDemand } from '../services/aiService';

// Mock the SDK
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    response: {
      text: () => '|||JSON|||{"categoria": "saude", "subcategoria": "agendamento", "resumo_ia": "Paciente solicita agendamento de consulta.", "prioridade": "media", "acao_sugerida": "Verificar disponibilidade na agenda da UBS", "precisa_retorno": true}|||JSON|||'
    }
  });

  const getGenerativeModelMock = vi.fn().mockReturnValue({
    generateContent: generateContentMock
  });

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function() {
      return {
        getGenerativeModel: getGenerativeModelMock
      };
    })
  };
});

describe('aiService', () => {
  it('should process citizen message and return structured JSON', async () => {
    const message = "Gostaria de marcar uma consulta na UBS";
    const context = "O cidadão está com dor de cabeça";
    
    const result = await processDemand(message, context);
    
    expect(result).toEqual({
      categoria: "saude",
      subcategoria: "agendamento",
      resumo_ia: "Paciente solicita agendamento de consulta.",
      prioridade: "media",
      acao_sugerida: "Verificar disponibilidade na agenda da UBS",
      precisa_retorno: true
    });
  });

  it('should throw an error if JSON delimiter is missing', async () => {
    // Modify mock for this specific test
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const mockedModel = (new GoogleGenerativeAI('') as any).getGenerativeModel();
    mockedModel.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Malformed response without delimiters'
      }
    });

    await expect(processDemand("test", "context")).rejects.toThrow("Falha ao processar resposta da IA: Formato inválido");
  });
});
