# Design Spec — Página Formulário Público

**Data:** 2026-05-14  
**Rota:** `/dashboard/formulario-publico`  
**Arquivo frontend:** `frontend/src/pages/Dashboard/FormularioPublico.tsx`

---

## Objetivo

Criar uma página dedicada no dashboard para visualizar e gerenciar as demandas enviadas pelos cidadãos via formulário público (`/p/:slug`). As demandas do formulário têm campos próprios (protocolo, foto, localização) que não se encaixam bem na página de Documentos, justificando uma área separada.

---

## Estrutura da Página

### Cabeçalho
- Título: "Formulário Público"
- Subtítulo com contagem total de demandas

### Painel de stats
Três cards clicáveis que filtram a lista:
- **Novas** (badge azul)
- **Em andamento** (badge amarelo)
- **Resolvidas** (badge verde)

### Barra de filtros
- Campo de busca por texto (nome do cidadão, protocolo, descrição)
- Dropdown de status (`nova` / `em_andamento` / `concluida`)
- Dropdown de categoria (populado via API, igual ao já existente em Demands)
- Date range: data inicial e data final (campo de data nativo)

### Lista de cards (paginada)
- Paginação: 25 / 50 / 100 resultados por página
- Ordenação: mais recente primeiro
- Cada card exibe:
  - Miniatura da foto (placeholder cinza se não houver)
  - Protocolo em destaque (`#2026-0042`)
  - Badge colorido de categoria
  - Descrição truncada em 2 linhas
  - Nome + telefone do cidadão
  - Localização em texto (se preenchida)
  - Badge de status + data de criação relativa (ex.: "há 2 horas")
- Clique no card → abre modal de detalhes

---

## Modal de Detalhes

Layout vertical compacto com cabeçalho roxo (`#1a0a3b`).

### Cabeçalho do modal
- Protocolo e título da demanda (ex.: `#2026-0042 — Buraco na rua`)
- Nome do cidadão + telefone + tempo relativo

### Corpo do modal (de cima para baixo)
1. **Grid de meta** (2 colunas): Categoria | Select de status
2. **Foto** — imagem em largura total, altura fixa (~160px), clicável para ampliar. Exibe placeholder se não houver foto.
3. **Descrição** — texto completo em caixa de fundo cinza claro
4. **Localização** — coordenadas ou texto, com ícone de pin. Omitido se não preenchido.

### Rodapé do modal (ações)
- Botão **"Responder via WhatsApp"** (verde, `#25d366`) — abre `https://wa.me/55{telefone}?text=...` com mensagem pré-preenchida: `"Olá {nome}, sobre sua solicitação protocolo {protocolo}..."`
- Botão **"Salvar status"** (roxo, `#6366f1`) — chama `PATCH /api/demands/:id/status`

---

## Alterações de Backend

### `listDemands` em `demandController.ts`
Adicionar suporte ao query param `origem`:

```typescript
const origem = req.query.origem as string;
// ...
if (origem) conditions.push(eq(demandas.origem, origem as any));
```

Nenhuma outra rota nova é necessária.

---

## Endpoints Utilizados

| Método | Rota | Uso |
|--------|------|-----|
| `GET` | `/api/demands?origem=formulario_publico&...` | Listar demandas com filtros |
| `PATCH` | `/api/demands/:id/status` | Atualizar status |
| `GET` | `/api/demands/categories` | Popular dropdown de categorias |

---

## Navegação

- **Sidebar:** nova entrada "Formulário Público" no grupo **Atendimento**, abaixo de "Documentos"
- **Ícone:** `ClipboardList` (Lucide React)
- **App.tsx:** nova rota protegida `/dashboard/formulario-publico`

---

## Fora de Escopo

- Mapa de localização (coordenadas mostradas como texto apenas)
- Envio de WhatsApp via API Evolution (link direto `wa.me` é suficiente)
- Atribuição de responsável interno (feature futura)
- Exportação PDF (feature futura)
