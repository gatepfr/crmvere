# Design Doc: Inteligência Eleitoral v3 (Estratégia Territorial Ativa)

**Data:** 18 de Abril de 2026  
**Status:** Em Revisão  
**Versão:** 1.0

## 1. Objetivo
Transformar o módulo de Eleições de um sistema de relatórios históricos passados em uma ferramenta de **Estratégia Territorial Ativa**. O sistema deve cruzar dados do TSE (votos reais) com dados do CRM (engajamento atual) para identificar "Vácuos Eleitorais" e orquestrar planos de expansão automática.

## 2. Conceitos Chave
*   **Vácuo Eleitoral:** Bairros onde o parlamentar teve votação expressiva no passado, mas possui baixa densidade de contatos no CRM em relação ao potencial.
*   **Conversão Territorial:** Relação percentual entre `Contatos no CRM / Votos Conquistados (TSE)`.
*   **Aliados Influentes (VIPs):** Munícipes identificados automaticamente por alto engajamento (demandas resolvidas) ou marcação manual (tags de liderança).

## 3. Arquitetura de Dados

### 3.1. Evolução do Schema (`backend/src/db/schema.ts`)
*   **`territorial_goals`**:
    *   `id`: uuid
    *   `tenantId`: uuid
    *   `ano`: integer
    *   `nmBairro`: varchar
    *   `metaVotos`: integer
    *   `metaContatos`: integer
*   **`territorial_intelligence_actions`**:
    *   `id`: uuid
    *   `tenantId`: uuid
    *   `nmBairro`: varchar
    *   `tipoAcao`: enum ('vácuo', 'meta_não_batida')
    *   `status`: enum ('pendente', 'executada')
    *   `createdAt`: timestamp

### 3.2. Lógica de Scoring de Munícipes (Influência)
A influência de um munícipe será calculada via serviço (View ou Query) baseada em:
1.  Quantidade de **Atendimentos Concluídos** (Peso alto).
2.  Presença de **Tag "Liderança"** no cadastro (Peso fixo).
3.  Tempo de permanência na base (Peso baixo).

## 4. Funcionalidades da "Inteligência" (Backend)

### 4.1. Motor de Identificação de Vácuo (Volume-based)
Um serviço que compara:
`Votos_TSE (Eleição Anterior)` vs `Munícipes_Cadastrados_no_Bairro (CRM)`.
*   **Gatilho:** Se `(Votos_TSE > Limite_A)` E `(Contatos_CRM / Votos_TSE < Limite_B)`, o bairro é marcado como "Vácuo Crítico".

### 4.2. Orquestrador de Plano de Ação (Combo D)
Ao ativar um plano para um bairro, o sistema deve:
1.  **Kanban:** Criar uma tarefa "Visita Territorial: [Bairro]" vinculada a um assessor.
2.  **Mailing:** Filtrar Munícipes VIPs do bairro e gerar uma lista para o WhatsApp (pedindo indicações).
3.  **Conteúdo IA:** Chamar o serviço de IA para gerar:
    *   1 Roteiro de vídeo focado nas demandas resolvidas naquele bairro.
    *   3 Sugestões de posts para Instagram/WhatsApp sobre temas locais.

## 5. Interface do Usuário (Frontend)

### 5.1. Dashboard de Estratégia
*   **Mapa de Calor Comparativo:** Sobreposição de camadas (Círculos de Votos vs Círculos de Contatos).
*   **Widget de Vácuos:** Lista lateral com os 5 bairros com maior "potencial desperdiçado".
*   **Botão "Gerar Plano de Expansão":** Disparador manual para o Orquestrador.

## 6. Critérios de Sucesso
*   Identificação automática de pelo menos 3 bairros de vácuo logo após o setup.
*   Geração de roteiros de IA contextualizados com o nome do bairro e categorias de demandas locais.
*   Criação de tarefas no Kanban com 1 clique a partir do Mapa.

---
## Autoria e Aprovação
*   **Autor:** Gemini CLI
*   **Aprovado por:** Usuário (Gabinete Digital)
