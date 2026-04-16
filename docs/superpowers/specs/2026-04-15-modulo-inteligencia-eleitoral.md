# Especificação Técnica: Módulo de Inteligência Eleitoral (v1.0)

## 1. Visão Geral
Este módulo adiciona ao CRM do Vereador a capacidade de importar, processar e analisar dados oficiais do TSE. O objetivo é transformar arquivos brutos em inteligência territorial acionável, permitindo que o vereador identifique redutos eleitorais, áreas de perda de votos e o perfil demográfico de quem vota em cada bairro/escola.

## 2. Arquitetura de Dados

### 2.1 Novas Tabelas (PostgreSQL)
- **`tse_candidatos`**: Registro dos candidatos vinculados aos gabinetes.
  - Campos: `id (uuid)`, `tenant_id`, `ano_eleicao`, `nm_candidato`, `nr_candidato`, `sg_partido`, `cd_municipio`, `nm_municipio`, `ds_situacao`, `qt_votos_total`.
- **`tse_locais_votacao`**: Cadastro geográfico das seções.
  - Campos: `id (serial)`, `ano_eleicao`, `cd_municipio`, `nr_zona`, `nr_local_votacao`, `nm_local_votacao`, `ds_endereco`, `nm_bairro`, `nr_cep`, `qt_eleitores`.
- **`tse_votos_secao`**: Votos detalhados por urna.
  - Campos: `id (serial)`, `ano_eleicao`, `cd_municipio`, `nr_zona`, `nr_secao`, `nr_local_votacao`, `nr_candidato`, `qt_votos`.
- **`tse_perfil_eleitorado`**: Dados demográficos por local/bairro.
  - Campos: `nm_bairro`, `ds_genero`, `ds_faixa_etaria`, `ds_grau_escolaridade`, `qt_eleitores`.

### 2.2 Performance
- Criaremos a **View Materializada** `votos_por_bairro` que pré-calcula a soma de votos por candidato em cada bairro, garantindo carregamento instantâneo do dashboard.

## 3. Motor de Importação (Python + Node.js)

### 3.1 Script Python (`tse_import.py`)
- **Tecnologia**: Python 3.11 + Pandas + Requests + Psycopg2.
- **Fluxo**:
  1. Recebe parâmetros (Ano, UF, Município, Cargo).
  2. Baixa ZIPs do Portal de Dados Abertos do TSE.
  3. Processa e filtra em memória (Pandas) para economizar recursos.
  4. Grava no banco de dados.
  5. **Auto-Cleanup**: Apaga todos os arquivos baixados e extraídos após a gravação.
- **Progresso**: Atualiza chaves no Redis (`tse:progress:{tenant_id}`) em tempo real (0-100%).

### 3.2 Backend (Node.js)
- Executa o script Python via `child_process.spawn`.
- Monitora a saúde do processo e reporta erros ao usuário.

## 4. Funcionalidades do Frontend

### 4.1 Wizard de Configuração
- Interface passo a passo para o Vereador se identificar:
  - Seleção de Ano, UF e Município.
  - Busca por nome/número e confirmação do registro oficial do TSE.
  - Gatilho para início da importação.

### 4.2 Dashboard de Inteligência
- **Aba Resumo**: Cards com Total de Votos, Ranking na Cidade e Variação % (2020 vs 2024).
- **Aba Bairros**: Tabela interativa com votos por bairro, % de penetração e badge de tendência (subiu/caiu).
- **Aba Perfil**: Gráficos de Sexo, Idade e Escolaridade predominante por região.

## 5. Próximos Passos (v1.1)
- Cruzamento de dados do TSE com os Munícipes já cadastrados no CRM.
- Mapa de calor georreferenciado (Heatmap).

---
**Documento gerado em:** 15/04/2026
**Responsável:** Gemini CLI Agent
