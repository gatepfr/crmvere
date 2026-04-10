# Design Spec - VereadorCRM
**Data:** 2026-04-09
**Status:** Validado pelo Usuário
**Objetivo:** CRM Multi-tenant para vereadores com atendimento automático via WhatsApp e IA.

## 1. Arquitetura do Sistema
O sistema será construído em uma arquitetura monorepo com `backend/` (Express + Node.js) e `frontend/` (React + TypeScript).

### Multi-tenancy
- **Isolamento:** Estratégia de "Row-Level Isolation" usando a coluna `tenant_id` em todas as tabelas (exceto a tabela `tenants` global).
- **Super Admin:** Uma interface global para cadastrar novos gabinetes (tenants) e gerenciar status de ativação.
- **Roles:** 
  - `super_admin`: Gerencia todos os tenants.
  - `admin`: Gerencia as configurações do seu próprio gabinete (IA, WhatsApp, Usuários).
  - `vereador`: Visualiza dashboards e demandas (leitura).
  - `assessor`: Gerencia a fila de demandas (leitura e escrita).

## 2. Banco de Dados (Drizzle ORM + PostgreSQL)
### Principais Tabelas:
- `tenants`: id, nome, municipio, uf, ativo (boolean), created_at.
- `users`: id, tenant_id, email, password_hash, role, status.
- `tenant_configs`: id, tenant_id, ai_provider (enum), ai_api_key (encrypted), whatsapp_provider, whatsapp_token (encrypted), prompt_base (text).
- `demandas`: id, tenant_id, municipe_id, protocolo, categoria, subcategoria, resumo_ia, status, prioridade, acao_sugerida.
- `municipipes`: id, tenant_id, nome, telefone, bairro, total_demandas.
- `historico_conversas`: id, municipe_id, mensagem, remetente (ia/municipe), timestamp.

## 3. Integrações (Motor de IA e WhatsApp)
- **WhatsApp:** Integração via Webhook com **Evolution API** (preferencial), Twilio ou Z-API. Normalização de payload para um formato único no backend.
- **IA (Motor):** Suporte a Anthropic, OpenAI e Google Gemini.
  - O motor deve retornar um JSON estruturado delimitado por `|||JSON|||` para facilitar a extração automática.
  - **Prompt Dinâmico:** Variáveis como `{{vereador_nome}}`, `{{municipio}}` e `{{bairros}}` serão injetadas em runtime.

## 4. Frontend (React + Tailwind)
- **Dashboard:** Cards de métricas (total, novas, em andamento, resolvidas) e gráficos de barras por categoria.
- **CRM:** Tabela de listagem com filtros rápidos por status e prioridade. Modal de detalhes para ver o resumo da IA e o histórico da conversa.
- **Configurações:** Painel para o Admin do gabinete configurar as chaves de API e o comportamento da IA.

## 5. Segurança e Qualidade
- **Autenticação:** JWT com cookies HttpOnly para o refresh token.
- **Segurança de API:** Middleware que injeta o `tenant_id` do usuário logado em todas as queries SQL via Drizzle.
- **Testes Obrigatórios:**
  - Login e expiração de sessão.
  - Processamento de webhook simulado.
  - Extração de JSON da resposta da IA.

## 6. Ordem de Implementação (Fases)
1. **Infra:** Docker Compose + Migrations iniciais.
2. **Auth:** Login, JWT e Proteção de Rotas.
3. **Admin:** Tela de Super Admin e criação de Tenants.
4. **Webhook:** Recebimento e normalização de mensagens.
5. **IA Engine:** Integração com LLMs e processamento de contexto.
6. **CRM:** Telas de listagem e gestão de demandas.
7. **Dashboard:** Gráficos e indicadores.
