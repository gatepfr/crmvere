# Design: Página de Documentos do Gabinete

**Data:** 2026-04-30
**Status:** Aprovado

## Contexto

O CRM já possui uma página de **Indicações** (`Legislativo.tsx`) para documentos formais enviados à câmara. O gabinete precisa de uma segunda página para outros tipos de documentos — ofícios, requerimentos, projetos de lei e encaminhamentos formais — que podem ser iniciados pelo próprio gabinete ou a pedido de um munícipe, sem precisar estar vinculados a uma demanda existente.

As Indicações existentes **não serão alteradas**.

## Objetivo

Criar uma página nova "Documentos" no menu lateral onde o gabinete pode registrar, acompanhar e arquivar documentos administrativos e legislativos, com ou sem vínculo a um munícipe.

---

## Modelo de Dados

Nova tabela `documentos` no banco de dados (sem alterar nenhuma tabela existente):

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid PK | sim | |
| `tenantId` | uuid FK → tenants | sim | Gabinete |
| `municipeId` | uuid FK → municipes | não | Munícipe vinculado (opcional) |
| `tipo` | varchar(50) | sim | `oficio` \| `requerimento` \| `projeto_lei` \| `encaminhamento_formal` \| `outro` |
| `titulo` | varchar(500) | sim | Assunto/título do documento |
| `descricao` | text | não | Detalhes adicionais |
| `origem` | varchar(20) | sim | `gabinete` \| `municipe` |
| `status` | varchar(20) | sim | `criado` \| `enviado` \| `concluido` — default `criado` |
| `numeroDocumento` | varchar(50) | não | Número de protocolo |
| `documentUrl` | varchar(500) | não | Link do arquivo (PDF/Drive) |
| `criadoPor` | uuid FK → users | sim | Usuário que criou |
| `createdAt` | timestamp | sim | default now() |
| `updatedAt` | timestamp | sim | default now() |

---

## Backend

### Arquivo novo: `backend/src/controllers/documentoController.ts`

Quatro operações:

- **`listDocumentos`** — `GET /documentos` — lista com filtros opcionais: `tipo`, `status`, `origem`, `search` (nome do munícipe ou título), paginação (page, limit)
- **`createDocumento`** — `POST /documentos` — cria novo registro
- **`updateDocumento`** — `PATCH /documentos/:id` — atualiza qualquer campo editável
- **`deleteDocumento`** — `DELETE /documentos/:id` — remove (só do próprio tenant)

### Arquivo novo: `backend/src/routes/documentoRoutes.ts`

Todas as rotas protegidas por `authenticate` + `checkTenant`.

### Migration nova

Drizzle migration criando a tabela `documentos` com os campos acima e índices em `tenantId`, `municipeId` e `status`.

### Schema (`backend/src/db/schema.ts`)

Adicionar a definição da tabela `documentos` com o enum de tipos e status.

---

## Frontend

### Arquivo novo: `frontend/src/pages/Dashboard/Documentos.tsx`

**Estrutura da página:**

```
┌─────────────────────────────────────────────────────────┐
│  DOCUMENTOS DO GABINETE              [+ NOVO DOCUMENTO]  │
│  Ofícios, Requerimentos e mais                           │
├──────────────────────────────────────────────────────────┤
│  [🔍 Buscar...]  [Tipo ▼]  [Status ▼]  [Origem ▼]       │
├──────────────────────────────────────────────────────────┤
│  TIPO         TÍTULO              MUNÍCIPE   STATUS   ... │
│  Ofício       Reparo Rua X        João S.    Enviado   ⋮ │
│  Requerimento Info Secretaria     —          Criado    ⋮ │
│  Projeto Lei  PL nº 012/2026      —          Concluído ⋮ │
├──────────────────────────────────────────────────────────┤
│  ← 1 2 3 →                          25 por página        │
└──────────────────────────────────────────────────────────┘
```

Colunas da tabela: Tipo (badge colorido), Título, Munícipe (ou "—"), Nº Protocolo, Status (badge), Data, Ações (editar/excluir).

Filtros: busca por texto livre, tipo, status, origem.

**Modal de criação/edição** (componente inline na página ou arquivo separado `DocumentoModal.tsx`):

```
Tipo         [dropdown: Ofício, Requerimento, Projeto de Lei,
              Encaminhamento Formal, Outro]
Título       [input texto]
Descrição    [textarea, opcional]
Origem       [radio: Gabinete | Munícipe]
Munícipe     [busca por nome ou telefone] ← visível só se origem = Munícipe
Nº Protocolo [input texto, opcional]
Link doc     [input URL, opcional]
Status       [dropdown: Criado, Enviado, Concluído]
```

O campo Munícipe usa a mesma busca já existente em `NewDemandModal.tsx`.

### Sidebar (`frontend/src/components/Sidebar.tsx`)

Adicionar item "Documentos" no grupo **Atendimento**, logo abaixo de "Indicações". Ícone sugerido: `FileText` (lucide-react).

### Rota (`frontend/src/App.tsx` ou equivalente)

Registrar `<Route path="/documentos" element={<Documentos />} />` na área autenticada do dashboard.

---

## O que NÃO está no escopo

- Notificações WhatsApp ao munícipe (pode ser adicionado futuramente)
- Vínculo com demandas existentes (pode ser adicionado futuramente)
- Histórico de alterações / activity log
- Atribuição a usuário específico
- Exportação PDF

---

## Critérios de conclusão

- [ ] Migration aplicada e tabela criada
- [ ] CRUD completo funcionando via API
- [ ] Página listando documentos com filtros e paginação
- [ ] Modal de criação e edição funcionando
- [ ] Campo munícipe aparece/desaparece conforme origem
- [ ] Item "Documentos" visível no menu lateral
- [ ] Nenhuma funcionalidade existente (Indicações, Demandas) afetada
