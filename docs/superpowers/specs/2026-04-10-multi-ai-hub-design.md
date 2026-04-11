# Design Spec: Hub Multi-IA (Single Configuration)

**Data:** 2026-04-10
**Status:** Aprovado (Brainstorming)
**Objetivo:** Permitir que o Gabinete escolha e configure um único provedor de IA entre os 4 gigantes (Gemini, OpenAI, Anthropic, Groq).

## 1. Experiência do Usuário (UX)

### Fluxo de Configuração
1. O Admin acessa a página "Configuração IA".
2. Seleciona o provedor desejado em um seletor visual (Grid de Cards ou Dropdown).
3. Ao selecionar, os campos específicos daquele provedor aparecem (API Key, Modelo).
4. O Admin salva e aquela IA passa a ser o motor oficial do gabinete.

---

## 2. Detalhamento Técnico

### Banco de Dados (Refatoração)
Atualmente temos campos fixos para `gemini_api_key`. Vamos migrar para uma estrutura mais genérica na tabela `tenants`:
- `ai_provider`: ENUM ('gemini', 'openai', 'anthropic', 'groq').
- `ai_api_key`: String (Criptografada).
- `ai_model`: String (ex: 'gpt-4o', 'claude-3-sonnet').
- `system_prompt`: Text (Mantido como já está).

### Backend (Refatoração do `aiService.ts`)
O serviço de IA agora usará o padrão **Factory**:
- Recebe o `ai_provider` do gabinete.
- Instancia o cliente correto (SDK do Google, OpenAI, etc.).
- Normaliza a resposta para o formato que o CRM espera.

### Provedores e Modelos Sugeridos
- **Gemini:** `gemini-1.5-flash`, `gemini-1.5-pro`.
- **OpenAI:** `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`.
- **Anthropic:** `claude-3-5-sonnet`, `claude-3-opus`.
- **Groq:** `llama-3-70b`, `mixtral-8x7b`.

---

## 3. Frontend (UI)
- **Página `AIConfig.tsx`:**
    - Cards grandes para selecionar o provedor (com logos).
    - Formulário dinâmico que muda conforme o provedor selecionado.
    - Seletor de modelos populares para cada provedor.

---

## 4. Critérios de Sucesso
- Ao trocar de Gemini para OpenAI e salvar, a próxima mensagem no WhatsApp deve ser processada pelo GPT-4.
- As chaves de API são validadas (teste de conexão) antes de salvar.
- A interface é intuitiva e permite trocar de provedor facilmente.
