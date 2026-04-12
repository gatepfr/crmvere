# Design Spec: Integração com Google Calendar

Este documento detalha o design e a implementação da funcionalidade de Agenda vinculada ao Google Calendar para os gabinetes dos vereadores.

## 1. Objetivos
- Permitir que cada gabinete configure sua própria agenda do Google.
- Disponibilizar uma visualização centralizada da agenda (datas e horários) dentro do dashboard.
- Facilitar a marcação de compromissos diretamente pela interface do sistema através de um painel incorporado.

## 2. Arquitetura e Dados

### 2.1. Backend (Banco de Dados)
Alteração na tabela `tenants` (através do Drizzle ORM):
- Adição da coluna `calendar_url`: `varchar("calendar_url", { length: 1000 })`.
  - Esta URL armazenará o link público ou de incorporação (`iframe`) do Google Calendar.

### 2.2. Frontend (Configurações)
Alteração em `CabinetConfig.tsx`:
- Novo campo de entrada: **"Link de Incorporação da Agenda"**.
- Instrução técnica: "Cole aqui o link público ou o código de incorporação (src) do seu Google Calendar (Configurações > Integrar Agenda)".

## 3. Interface do Usuário (UI)

### 3.1. Menu Lateral (Sidebar)
- Novo item: **"Agenda"**.
- Ícone: `Calendar` da biblioteca `lucide-react`.
- Rota: `/dashboard/agenda`.

### 3.2. Página de Agenda (`Agenda.tsx`)
- **Estado Inicial:** Se `calendar_url` estiver vazio, exibe um card com mensagem de "Agenda não configurada" e um link para as configurações.
- **Painel de Agenda:** Um contêiner responsivo contendo um `iframe`.
  - O `src` do `iframe` será o valor de `calendar_url`.
  - Estilo: Borda arredondada, sombra leve, altura mínima de 600px para garantir boa visibilidade dos horários.

## 4. Fluxo de Implementação
1. **Database:** Rodar migration para adicionar `calendar_url` na tabela `tenants`.
2. **Backend:** Atualizar as rotas de configuração (`/config/me` e `/config/update`) para suportar o novo campo.
3. **Frontend - Config:** Adicionar o campo na tela de Dados do Gabinete.
4. **Frontend - Navegação:** Registrar a nova rota e adicionar o item ao menu lateral.
5. **Frontend - Página:** Criar o componente `Agenda.tsx` com o painel de visualização.

## 5. Testes e Validação
- Validar se o link salvo é persistido corretamente no banco.
- Verificar se o `iframe` carrega corretamente diferentes tipos de links do Google Calendar.
- Testar a responsividade da agenda em dispositivos móveis.
