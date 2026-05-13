# Página Pública de Demandas — Design Spec

**Data:** 2026-05-13
**Status:** Aprovado para implementação

---

## Visão Geral

Cada tenant do CRM do Verê terá uma página pública acessível sem autenticação onde cidadãos podem enviar demandas diretamente ao gabinete do vereador. A demanda cai automaticamente no CRM, o munícipe é criado ou vinculado, e dois disparos de WhatsApp são feitos (cidadão + equipe).

**URL pública:** `app.crmvere.com.br/p/:slug`
Exemplo: `app.crmvere.com.br/p/valdirsanta`

---

## Arquitetura

### Frontend
- Nova rota pública `/p/:slug` no React existente (sem wrapper de autenticação)
- Componente `PublicDemandPage` — tela única, mobile-first
- Rota adicionada no router antes do `<AuthGuard>` para não exigir login

### Backend
- Novo arquivo `src/routes/publicRoutes.ts` sem `authenticate` middleware
- Dois endpoints:
  - `GET /api/public/tenant/:slug` — retorna dados públicos do tenant
  - `POST /api/public/demanda/:slug` — recebe e processa a demanda (multipart/form-data)
- Rate limiting: 10 requisições por IP por hora no endpoint POST

### Banco de Dados
- Adicionar coluna `origem varchar(50)` na tabela `demandas` (migration Drizzle)
  - Valores: `"formulario_publico"`, `"whatsapp"`, `"instagram"`, `"manual"`
  - Existing rows: `NULL` (compatível com código atual)
- Coluna `fotoUrl varchar(500)` na tabela `demandas` para foto enviada pelo cidadão

---

## Página Pública — Layout

Tela única, scroll vertical, sem paginação.

### Cabeçalho
- Avatar circular (64px) com borda dourada:
  - **Com foto:** `tenant.fotoUrl` (foto cadastrada no perfil do gabinete)
  - **Sem foto:** imagem `icone_foguete.png` (logo do CRM do Verê) com fundo gradiente roxo escuro
- Nome do vereador (`tenant.name`)
- Cidade + UF + Partido (`tenant.municipio`, `tenant.uf`, `tenant.partido`)
- Fundo: gradiente `#1a0a3b → #2d1b69`

### Seção: Tipo de demanda
- Grid 3 colunas com as categorias do tenant (`GET /api/public/tenant/:slug` retorna lista)
- Fallback: categorias globais se tenant não tiver nenhuma configurada
- Cada categoria: emoji/ícone + nome
- Seleção única obrigatória

### Seção: Localização
- Campo de texto livre + botão 📍 à direita
- Botão 📍: chama `navigator.geolocation.getCurrentPosition()`, converte coordenadas em endereço via OpenStreetMap Nominatim (`nominatim.openstreetmap.org/reverse`) — gratuito, sem chave de API
- Campo preenchível manualmente como fallback

### Seção: Descrição
- Textarea livre, obrigatório, mínimo 10 caracteres

### Seção: Foto (opcional)
- Input file (jpg/png), limite 5MB
- Preview da imagem após seleção
- Upload feito junto com o form (multipart/form-data)

### Seção: Dados do cidadão
- **Nome** — texto livre, obrigatório
- **Telefone** — com máscara `(99) 99999-9999`, obrigatório
  - Salvo internamente sem formatação: `5543999990000`

### Botão de envio
- "📤 Enviar Demanda"
- Loading state durante o POST
- Sucesso: tela de confirmação com protocolo ("Demanda #2026-0042 enviada!")
- Erro: mensagem inline sem perder os dados do form

---

## Backend — Endpoint Público

### `GET /api/public/tenant/:slug`

Retorna apenas dados públicos (sem tokens, sem configurações sensíveis):
```json
{
  "name": "Vereador Valdir Santa Fé",
  "municipio": "Londrina",
  "uf": "PR",
  "partido": "MDB",
  "fotoUrl": "https://...",
  "categories": [
    { "id": "uuid", "name": "Buracos", "icon": "🕳️", "color": "#..." }
  ]
}
```

Retorna 404 se slug não encontrado ou tenant inativo/bloqueado.

### `POST /api/public/demanda/:slug`

**Body:** `multipart/form-data`
- `categoriaId` (string, obrigatório)
- `descricao` (string, obrigatório)
- `localizacao` (string, opcional)
- `nome` (string, obrigatório)
- `telefone` (string, obrigatório — salvo sem formatação)
- `foto` (file, opcional)

**Processamento:**
1. Valida campos obrigatórios
2. Busca tenant por slug — retorna 404 se inativo/bloqueado
3. Limpa telefone: remove `()`, espaços, `-`, adiciona `55` se não tiver
4. **Upsert munícipe:** `INSERT ... ON CONFLICT (tenant_id, phone) DO NOTHING` — retorna o existente ou o novo
5. Faz upload da foto se presente → salva em `uploads/demandas/` → armazena URL
6. **Resolve categoria:** busca `demandCategories` pelo `categoriaId` para obter o nome — a coluna `demandas.categoria` armazena o nome (varchar), não o UUID
7. Cria demanda com `origem: "formulario_publico"`
7. Gera número de protocolo (`YYYY-NNNN` sequencial por tenant)
8. Dispara WhatsApp para o cidadão (se tenant tiver WhatsApp configurado)
9. Dispara WhatsApp para `tenant.whatsappNotificationNumber` (se configurado)
10. Retorna `{ protocolo: "2026-0042", message: "Demanda recebida!" }`

**Mensagens WhatsApp:**

Para o cidadão:
```
✅ Demanda recebida!

Olá, [nome]! Sua demanda foi registrada com sucesso no gabinete do [vereador].

📋 Protocolo: #2026-0042
📌 Categoria: Buracos
📍 Local: Rua XV de Novembro, 450

O vereador vai dar andamento o mais breve possível. Obrigado pelo contato!
```

Para a equipe:
```
🔔 Nova demanda via formulário público!

👤 [nome] — 📱 [telefone]
📌 [categoria] — 📍 [localização]
📝 [primeiros 100 chars da descrição]...

Acesse o CRM para visualizar e atribuir.
```

---

## Campos novos no banco

```sql
-- Na tabela demandas:
ALTER TABLE demandas ADD COLUMN origem VARCHAR(50);
ALTER TABLE demandas ADD COLUMN foto_url VARCHAR(500);
ALTER TABLE demandas ADD COLUMN localizacao VARCHAR(500);
ALTER TABLE demandas ADD COLUMN protocolo VARCHAR(20);
```

Drizzle migration gerada com `drizzle-kit generate`.

---

## Visibilidade no CRM

- As demandas `origem = "formulario_publico"` aparecem na listagem normal de demandas
- Badge/tag "Via Formulário" visível na demanda para o time saber a origem
- Foto aparece na visualização da demanda
- Protocolo exibido no detalhe da demanda

---

## Segurança

- Endpoints públicos sem autenticação, mas com rate limiting (10 req/IP/hora no POST)
- Nenhum dado sensível do tenant exposto pelo `GET /tenant/:slug` (sem tokens, API keys, etc.)
- Upload de foto: validação de tipo MIME no backend (apenas image/jpeg, image/png)
- Telefone sanitizado antes de salvar e antes de enviar pelo WhatsApp
- Tenant bloqueado ou inativo retorna 404 (não revela motivo)

---

## Fora do Escopo (esta fase)

- Acompanhamento de demanda pelo cidadão (consulta por protocolo)
- Notificação de status ao cidadão quando demanda for resolvida
- QR Code gerado automaticamente no CRM para a URL pública
- Mapa com geolocalização exibido no CRM
