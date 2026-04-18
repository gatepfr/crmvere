import { describe, it, expect } from 'vitest';
import { calculateInfluenceScore } from '../services/intelligenceService';

describe('IntelligenceService - Lógica de Scoring', () => {
  it('deve calcular 10 pontos por atendimento sem ser liderança', () => {
    const score = calculateInfluenceScore(3, false);
    expect(score).toBe(30);
  });

  it('deve adicionar 50 pontos se for liderança declarada', () => {
    const score = calculateInfluenceScore(2, true);
    expect(score).toBe(70); // (2*10) + 50
  });

  it('deve retornar zero se não houver engajamento nem liderança', () => {
    const score = calculateInfluenceScore(0, false);
    expect(score).toBe(0);
  });
});
