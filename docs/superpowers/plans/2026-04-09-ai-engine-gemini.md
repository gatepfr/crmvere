# AI Engine Service (Gemini Integration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a service that uses Gemini AI to analyze citizen messages and return structured data (category, subcategory, summary, priority, etc.).

**Architecture:** A service class or set of functions in `backend/src/services/aiService.ts` that interacts with the `@google/generative-ai` SDK. It uses a specific prompt to force the model to return JSON wrapped in `|||JSON|||` delimiters.

**Tech Stack:** TypeScript, Node.js, `@google/generative-ai`, Vitest for testing.

---

### Task 1: Environment Setup

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`

- [ ] **Step 1: Install `@google/generative-ai`**
Run: `npm install @google/generative-ai` in `backend/`

- [ ] **Step 2: Update `.env.example`**
Add `GEMINI_API_KEY=` to `backend/.env.example`.

- [ ] **Step 3: Commit**
```bash
git add package.json package-lock.json .env.example
git commit -m "chore: setup dependencies and env for AI Engine"
```

---

### Task 2: Implement AI Engine Service (TDD)

**Files:**
- Create: `backend/src/services/aiService.ts`
- Test: `backend/src/__tests__/aiService.test.ts`

- [ ] **Step 1: Write the failing test for `processDemand`**
Create `backend/src/__tests__/aiService.test.ts` with mocks for `@google/generative-ai`.

```typescript
import { vi, describe, it, expect } from 'vitest';
import { processDemand } from '../services/aiService';

// Mock the SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => '|||JSON|||{"categoria": "saude", "subcategoria": "agendamento", "resumo_ia": "Paciente solicita agendamento de consulta.", "prioridade": "media", "acao_sugerida": "Verificar disponibilidade na agenda da UBS", "precisa_retorno": true}|||JSON|||'
          }
        })
      })
    }))
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

  it('should handle malformed AI response gracefully', async () => {
    // This will be implemented in Step 3
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test backend/src/__tests__/aiService.test.ts`
Expected: FAIL (module or function not found)

- [ ] **Step 3: Implement `processDemand` in `aiService.ts`**
Create `backend/src/services/aiService.ts`.

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface AIDemandResult {
  categoria: 'saude' | 'infraestrutura' | 'seguranca' | 'educacao' | 'outro';
  subcategoria: string;
  resumo_ia: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  acao_sugerida: string;
  precisa_retorno: boolean;
}

export async function processDemand(messageText: string, context?: string): Promise<AIDemandResult> {
  const prompt = `
    Analise a seguinte mensagem de um cidadão e extraia informações estruturadas.
    Contexto adicional: ${context || 'Nenhum'}
    Mensagem: ${messageText}

    Retorne APENAS um JSON no seguinte formato, envolto por |||JSON|||:
    {
      "categoria": "saude" | "infraestrutura" | "seguranca" | "educacao" | "outro",
      "subcategoria": "texto curto",
      "resumo_ia": "resumo conciso",
      "prioridade": "baixa" | "media" | "alta" | "urgente",
      "acao_sugerida": "o que o vereador deve fazer",
      "precisa_retorno": boolean
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  const jsonMatch = text.match(/\|\|\|JSON\|\|\|([\s\S]*?)\|\|\|JSON\|\|\|/);
  if (!jsonMatch) {
    throw new Error("Falha ao processar resposta da IA: Formato inválido");
  }

  return JSON.parse(jsonMatch[1].trim());
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test backend/src/__tests__/aiService.test.ts`
Expected: PASS

- [ ] **Step 5: Add more robust error handling and tests**
Update `aiService.test.ts` with error cases and refine `aiService.ts` if needed.

- [ ] **Step 6: Final Commit**
```bash
git add backend/src/services/aiService.ts backend/src/__tests__/aiService.test.ts
git commit -m "feat: implement AI Engine service with Gemini"
```
