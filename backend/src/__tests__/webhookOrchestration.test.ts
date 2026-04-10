import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db';
import * as aiService from '../services/aiService';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
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

    // 1. Mock municipe check (not found)
    const selectMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]), // Return empty array -> not found
    };
    (db.select as any).mockReturnValue(selectMock);

    // 2. Mock municipe creation
    const insertMunicipeMock = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'municipe-123', name: 'John Doe', phone: '5511999999999' }]),
    };
    (db.insert as any).mockReturnValueOnce(insertMunicipeMock);

    // 3. Mock AI service
    (aiService.processDemand as any).mockResolvedValue({
      categoria: 'infraestrutura',
      prioridade: 'media',
      resumo_ia: 'Solicitação de reparo de buraco na rua',
      subcategoria: 'vias públicas',
      acao_sugerida: 'Encaminhar para secretaria de obras',
      precisa_retorno: true
    });

    // 4. Mock demanda creation
    const insertDemandaMock = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'demanda-456' }]),
    };
    (db.insert as any).mockReturnValueOnce(insertDemandaMock);

    const response = await request(app)
      .post(`/api/webhook/evolution/${tenantId}`)
      .send(payload);

    expect(response.status).toBe(200);
    
    // Verify municipe search
    expect(db.select).toHaveBeenCalled();
    
    // Verify AI service call
    expect(aiService.processDemand).toHaveBeenCalledWith('Tem um buraco na minha rua');

    // Verify database inserts
    // Note: Since insert is called twice, we check calls
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});
