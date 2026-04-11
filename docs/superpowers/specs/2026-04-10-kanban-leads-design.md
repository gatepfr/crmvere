# Design Spec: Funil de Leads Kanban (Campanhas)

**Data:** 2026-04-10
**Status:** Aprovado (Brainstorming)
**Objetivo:** Permitir a gestão de leads e contatos através de quadros Kanban dinâmicos, organizados por Campanhas.

## 1. Experiência do Usuário (UX)

### Estrutura de Quadros (Boards)
- O usuário pode criar múltiplas "Campanhas" (ex: Campanha de Reeleição, Base de Apoio, Parceiros Locais).
- Cada Campanha tem seu próprio quadro Kanban com colunas independentes.

### Funcionalidades do Kanban
- **Drag and Drop:** Arrastar cards entre colunas para atualizar o status do lead.
- **Cards de Lead:** Exibem Nome, Bairro e Ícone de prioridade.
- **Customização:** Adicionar/Remover colunas em cada Campanha.

---

## 2. Detalhamento Técnico

### Banco de Dados (Novas Tabelas)
- `campaigns`:
    - `id` (UUID)
    - `tenantId` (FK)
    - `name` (varchar)
    - `createdAt`
- `campaign_columns`:
    - `id` (UUID)
    - `campaignId` (FK)
    - `name` (varchar)
    - `order` (int)
- `leads`:
    - `id` (UUID)
    - `tenantId` (FK)
    - `campaignId` (FK)
    - `columnId` (FK)
    - `municipeId` (FK - Opcional, vincula ao contato do WhatsApp)
    - `name`, `email`, `phone`, `tags`

### Backend (Node.js)
- **Rotas de Kanban (`/api/kanban`):**
    - `GET /campaigns`: Lista campanhas do gabinete.
    - `POST /campaigns`: Cria nova campanha.
    - `GET /campaigns/:id/board`: Retorna colunas e leads daquela campanha.
    - `PATCH /leads/:id/move`: Atualiza a `columnId` do lead ao arrastar.

### Frontend (React + dnd-kit)
- **Biblioteca:** `@dnd-kit/core` e `@dnd-kit/sortable` para arrastar e soltar suavemente.
- **Página `KanbanLeads.tsx`:** Interface estilo Trello com colunas horizontais.

---

## 3. Integração com WhatsApp
- Opção de "Mover para Kanban" diretamente da lista de Demandas.
- Ao mover, o cidadão vira um Lead em uma campanha selecionada.

---

## 4. Critérios de Sucesso
- Usuário consegue criar uma Campanha e definir 3 colunas.
- Usuário consegue arrastar um lead da Coluna A para a B e a mudança é salva no banco.
- O sistema suporta múltiplos quadros sem misturar os leads.
