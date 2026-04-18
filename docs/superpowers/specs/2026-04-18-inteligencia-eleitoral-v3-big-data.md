# Spec: Inteligência Eleitoral v3 (Big Data e Estratégia Territorial)

**Data:** 18 de Abril de 2026  
**Status:** Em Revisão  
**Versão:** 2.0 (Evolução Big Data)

## 1. Visão Geral
Transformar o módulo de Eleições em uma central de **Big Data Eleitoral** que cruza dados oficiais do TSE (limpos e padronizados) com o engajamento real do CRM. O objetivo é eliminar erros de codificação de arquivos e fornecer uma visão estratégica de "Vácuos Eleitorais" de forma instantânea.

## 2. Arquitetura de Dados (Big Data)

### 2.1. Repositório Central de Dados (O Cache)
*   **Conceito:** O sistema não dependerá apenas de downloads diretos do TSE por cada gabinete. Ele consultará primeiro um repositório central de arquivos JSON/CSV já limpos (UTF-8).
*   **Fallback (Opção A):** Se a cidade não estiver no repositório, o sistema:
    1. Baixa do TSE (via Script Python refatorado).
    2. Realiza a limpeza de caracteres especiais e padronização de bairros.
    3. Alimenta o banco de dados do gabinete.
    4. (Opcional) Envia os dados limpos de volta ao repositório central para futuros gabinetes.

### 2.2. Schema de Inteligência (Já implementado)
*   `territorial_goals`: Metas de votos e contatos por bairro.
*   `territorial_intelligence_actions`: Log de ações executadas (Combo D).

## 3. Motor de Inteligência Estratégica

### 3.1. Identificação de Vácuos (Cálculo)
O sistema calcula o **Vácuo Crítico** onde:
`Votos_TSE > 500` E `(Contatos_CRM / Votos_TSE) < 0.10` (menos de 10% de conversão).

### 3.2. Orquestrador de Expansão (Combo D)
Ação em um clique para bairros críticos:
1. **Mailing Direcionado:** Filtra aliados influentes (VIPs) no bairro para abordagem via WhatsApp.
2. **Kanban:** Cria tarefa de visita ou ação territorial para assessores.
3. **IA Generativa:** Gera roteiro de vídeo e posts contextuais com as dores/conquistas daquele bairro específico.

## 4. Interface do Usuário (Frontend)

### 4.1. Dashboard de Estratégia Territorial
*   **Mapa de Calor Comparativo:** Círculos vermelhos (Vácuo), Amarelos (Potencial) e Verdes (Consolidados).
*   **Painel de Metas:** Gráfico de progresso "Meta de 2026" (Contatos CRM vs Meta de Votos).
*   **Widget de Lideranças:** Lista dos munícipes com maior "Score de Influência" no bairro selecionado.

## 5. Requisitos Técnicos de Implementação
*   **Backend:** Refatoração do `tse_import.py` para garantir codificação UTF-8 e integração com repositório central.
*   **IntelligenceService:** Implementação da lógica de vácuo e scoring de aliados (Híbrido: Engajamento + Tags).
*   **Frontend:** Novo módulo em `frontend/src/pages/Intelligence/StrategicDashboard.tsx`.

---
## Critérios de Aceite
1. Importação de dados de uma cidade nova sem erros de acentuação/codificação.
2. Visualização clara no mapa de quais bairros precisam de atenção imediata (Vácuos).
3. Criação automática de tarefa no Kanban ao disparar um Plano de Ação.
