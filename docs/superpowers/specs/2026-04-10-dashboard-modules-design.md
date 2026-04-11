# Design Spec: Dashboard Modular Moderno (VereadorCRM)

**Data:** 2026-04-10
**Status:** Aprovado (Brainstorming)
**Objetivo:** Transformar o VereadorCRM em uma ferramenta profissional com módulos dedicados para IA, WhatsApp e Base de Conhecimento, utilizando um design moderno e intuitivo.

## 1. Visão Geral do Design (UI/UX)

O sistema adotará uma **Abordagem Focada em Módulos** com navegação lateral (Sidebar).

### Elementos Visuais
- **Sidebar (Menu Lateral):** Fixo à esquerda, fundo escuro (Slate 900) com ícones em branco/azul.
- **Área de Conteúdo:** Fundo claro (Slate 50), cards brancos com sombras suaves e bordas arredondadas (Rounded-lg).
- **Tipografia:** Inter ou Sans-serif moderna, foco em legibilidade.
- **Feedback:** Badges de status (Verde para Online, Vermelho para Offline/Erro).

### Estrutura do Menu
1. **Dashboard:** Métricas rápidas (Demandas totais, status da IA).
2. **Demandas:** Lista principal de mensagens recebidas.
3. **WhatsApp:** Gestão da conexão com Evolution API (QR Code, Instância).
4. **Configuração de IA:** Ajustes finos do Gemini (API Key, Prompt, Modelo).
5. **Base de Conhecimento:** Upload e gestão de documentos (PDFs) para a IA ler.

---

## 2. Arquitetura Técnica

### Frontend (React + Vite + Tailwind)
- **Componente Sidebar:** Navegação global usando `NavLink` do React Router.
- **Páginas Modulares:** Cada item do menu terá sua própria rota e componente principal.
- **Contexto de Configuração:** Um Context API para gerenciar o estado global das configurações (ex: status da conexão).

### Backend (Node.js + Express + Drizzle ORM)
- **Novas Tabelas/Campos:**
    - `tenants`: Adicionar campos para `gemini_api_key`, `system_prompt`, `ai_model`.
    - `documents`: Nova tabela para armazenar metadados de arquivos da base de conhecimento.
    - `whatsapp_config`: Tabela para armazenar ID da instância e token da Evolution API por tenant.
- **Segurança:** Isolamento rigoroso por `tenantId` em todas as consultas SQL.

### Integrações
- **Gemini AI:** Integração via SDK oficial da Google.
- **Evolution API (WhatsApp):** Proxy de requisições para gerenciar QR Code e Webhooks.

---

## 3. Detalhamento dos Módulos

### Módulo IA (Gemini)
- **Interface:** Formulário limpo com campos para API Key (password type), seletor de modelo (Flash vs Pro) e um `textarea` grande para o "System Prompt".
- **Comportamento:** A IA usará o prompt definido pelo vereador para processar as mensagens recebidas via WhatsApp.

### Módulo WhatsApp (Evolution API)
- **Interface:** Card central exibindo o QR Code gerado em tempo real.
- **Status:** Indicador dinâmico de "Conectado" ou "Aguardando QR Code".
- **Automatização:** O Webhook será configurado automaticamente para apontar para o backend do CRM.

### Módulo Base de Conhecimento (Dados)
- **Interface:** Área de upload com progresso e lista de arquivos.
- **Processamento:** Extração de texto de PDFs para serem incluídos no contexto da IA durante o atendimento.

---

## 4. Segurança e Privacidade
- **Isolamento:** Uso de middleware de Tenant em todas as rotas para garantir que chaves e dados não vazem entre gabinetes.
- **Criptografia:** Chaves sensíveis (API Keys) devem ser armazenadas de forma segura.

---

## 5. Critérios de Sucesso
- O usuário consegue alternar entre módulos sem recarregar a página.
- O QR Code do WhatsApp é exibido e pareado corretamente.
- A IA responde demandas usando a personalidade configurada no Prompt de Sistema.
- O design é responsivo e visualmente superior à versão atual.
