# Design Spec: Gestão de Equipe e Perfil

**Data:** 2026-04-10
**Status:** Aprovado (Brainstorming)
**Objetivo:** Permitir que o Vereador (Admin) gerencie sua equipe de assessores e que todos os usuários possam gerenciar suas credenciais.

## 1. Gestão de Equipe (Users Management)

### Funcionalidades
- **Listagem:** Visualizar todos os usuários vinculados ao Gabinete (Tenant).
- **Criação:** Adicionar novo assessor informando apenas Nome e Email.
- **Senha Padrão:** Novos assessores terão a senha inicial `assessor123`.
- **Exclusão:** Remover acesso de um assessor ao gabinete.

### Níveis de Acesso
- `admin` / `vereador`: Acesso total a configurações e equipe.
- `assessor`: Acesso apenas à visualização e resposta de demandas.

---

## 2. Meu Perfil (User Profile)

### Funcionalidades
- **Alteração de Senha:** Campo para o usuário logado digitar a nova senha e confirmar.
- **Dados Básicos:** Visualizar email e cargo atual.

---

## 3. Detalhamento Técnico

### Backend (Node.js)
- **Rotas de Equipe (`/api/team`):**
    - `GET /`: Lista usuários do mesmo `tenantId`.
    - `POST /`: Cria novo usuário com `role: assessor` e senha hash de `assessor123`.
    - `DELETE /:id`: Remove o usuário (garantindo que um usuário não se exclua).
- **Rotas de Perfil (`/api/profile`):**
    - `PATCH /password`: Atualiza o `passwordHash` do usuário autenticado.

### Frontend (React)
- **Página `Team.tsx`:** Tabela moderna com botão de "+ Adicionar".
- **Página `Profile.tsx`:** Formulário simples de troca de senha.
- **Sidebar:** Adicionar link para "Equipe" e "Meu Perfil".

---

## 4. Critérios de Sucesso
- Vereador consegue criar um assessor que consegue logar com a senha `assessor123`.
- Um assessor não consegue visualizar o menu de "Equipe" ou "Configuração de IA".
- Qualquer usuário consegue alterar sua própria senha.
