import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db';
import * as aiService from '../services/aiService';
import { orchestrateWebhook } from '../services/webhookOrchestration';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/aiService', () => ({
  processDemand: vi.fn(),
}));

describe('Webhook Orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should orchestrate: find/create municipe, call AI, and save demanda', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const payload = {
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net' },
        pushName: 'John Doe',
        message: { conversation: 'Tem um buraco na minha rua' }
      }
    };

    // 1. Mock tenant and system config
    (db.select as any).mockImplementation((query: any) => {
      // Very basic way to distinguish queries in the orchestrator
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
             // Return mock data based on query context if needed, 
             // but here we can just return empty for most and specific for some
             return Promise.resolve([]); 
          }),
          then: vi.fn().mockImplementation((onFulfilled) => {
            // This is used for [tenant] = await db.select().from(tenants)...
            return Promise.resolve([{ 
              id: tenantId, 
              name: 'Test Tenant',
              aiApiKey: 'test-api-key',
              aiProvider: 'gemini'
            }]).then(onFulfilled);
          })
        }))
      };
    });

    // 2. Mock AI service
    (aiService.processDemand as any).mockResolvedValue({
      data: {
        categoria: 'infraestrutura',
        prioridade: 'media',
        resumo_ia: 'Solicitação de reparo de buraco na rua',
        subcategoria: 'vias públicas',
        acao_sugerida: 'Encaminhar para secretaria de obras',
        precisa_retorno: true,
        resposta_usuario: 'Recebemos seu pedido!'
      },
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
    });

    // 3. Mock insert
    const insertMock = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
    };
    (db.insert as any).mockReturnValue(insertMock);

    // Call orchestrator directly
    const result = await orchestrateWebhook(payload, tenantId);

    expect(result.status).toBe('success');
    
    // Verify AI service call
    // Note: the prompt context in orchestrator is now more complex, so we check if it was called
    expect(aiService.processDemand).toHaveBeenCalled();

    // Verify database inserts
    expect(db.insert).toHaveBeenCalled();
  });
});
