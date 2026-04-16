# Plano de Implementação: Módulo de Inteligência Eleitoral (v1.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar um módulo completo de análise de dados do TSE, permitindo a importação automática de votos por seção/bairro e a visualização inteligente de redutos eleitorais e perfil demográfico.

**Architecture:** Abordagem híbrida onde o Backend Node.js orquestra um script Python especializado em processamento de dados (Pandas) rodando em background. A performance é garantida por uma View Materializada no PostgreSQL e o progresso é reportado via Redis.

**Tech Stack:** Node.js (Express), Python 3.11 (Pandas, Requests, Psycopg2), PostgreSQL (Drizzle ORM), Redis, React (Tailwind, Lucide).

---

### Task 1: Preparação do Ambiente Docker (Backend)

**Files:**
- Modify: `backend/Dockerfile`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Criar o arquivo requirements.txt**
```text
pandas==2.2.1
requests==2.31.0
psycopg2-binary==2.9.9
redis==5.0.3
```

- [ ] **Step 2: Atualizar o Dockerfile do backend para instalar Python e dependências**
```dockerfile
# ... antes do RUN npm run build ...
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && apt-get clean
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages
```

- [ ] **Step 3: Commit**
```bash
git add backend/requirements.txt backend/Dockerfile
git commit -m "infra: instalar python e dependências de dados no container do backend"
```

---

### Task 2: Esquema do Banco de Dados (Schema)

**Files:**
- Modify: `backend/src/db/schema.ts`
- Test: `backend/src/__tests__/tse_schema.test.ts`

- [ ] **Step 1: Definir as tabelas tse_* no schema.ts**
```typescript
export const tseCandidatos = pgTable("tse_candidatos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  anoEleicao: integer("ano_eleicao").notNull(),
  nmCandidato: varchar("nm_candidato", { length: 255 }).notNull(),
  nrCandidato: varchar("nr_candidato", { length: 20 }).notNull(),
  sgPartido: varchar("sg_partido", { length: 20 }),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nmMunicipio: varchar("nm_municipio", { length: 255 }),
  dsSituacao: varchar("ds_situacao", { length: 100 }),
  qtVotosTotal: integer("qt_votos_total").default(0),
  createdAt: timestamp("created_at").defaultNow()
});

export const tseLocaisVotacao = pgTable("tse_locais_votacao", {
  id: serial("id").primaryKey(),
  anoEleicao: integer("ano_eleicao").notNull(),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nrZona: integer("nr_zona"),
  nrLocalVotacao: integer("nr_local_votacao"),
  nmLocalVotacao: varchar("nm_local_votacao", { length: 255 }),
  dsEndereco: varchar("ds_endereco", { length: 500 }),
  nmBairro: varchar("nm_bairro", { length: 255 }),
  nrCep: varchar("nr_cep", { length: 20 }),
  qtEleitores: integer("qt_eleitores")
});

export const tseVotosSecao = pgTable("tse_votos_secao", {
  id: serial("id").primaryKey(),
  anoEleicao: integer("ano_eleicao").notNull(),
  cdMunicipio: varchar("cd_municipio", { length: 20 }),
  nrZona: integer("nr_zona"),
  nrSecao: integer("nr_secao"),
  nrLocalVotacao: integer("nr_local_votacao"),
  nrCandidato: varchar("nr_candidato", { length: 20 }),
  qtVotos: integer("qt_votos")
});
```

- [ ] **Step 2: Gerar e aplicar migrações**
```bash
cd backend
npm run db:migrate
```

---

### Task 3: Motor de Importação Python

**Files:**
- Create: `backend/src/scripts/tse_import.py`

- [ ] **Step 1: Implementar o script de download e processamento (Esqueleto inicial)**
```python
import pandas as pd
import requests
import os
import sys
import psycopg2
import redis

# Configurações de ambiente
DATABASE_URL = os.getenv('DATABASE_URL')
REDIS_URL = os.getenv('REDIS_URL')

def report_progress(tenant_id, step, percent):
    r = redis.from_url(REDIS_URL)
    r.set(f"tse:import:{tenant_id}:progress", percent)
    r.set(f"tse:import:{tenant_id}:step", step)

def process_import(ano, uf, municipio, nr_candidato, tenant_id):
    report_progress(tenant_id, "Baixando dados do TSE...", 10)
    # 1. Download ZIP (Portal TSE)
    # 2. Filtrar via Pandas
    # 3. Inserir no Postgres via COPY ou Batch Insert
    # 4. Limpar arquivos temporários
    report_progress(tenant_id, "Concluído!", 100)

if __name__ == "__main__":
    # Args: ano, uf, municipio, nr_candidato, tenant_id
    process_import(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
```

---

### Task 4: API de Controle (Node.js)

**Files:**
- Create: `backend/src/routes/eleicoesRoutes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Criar rota para disparar o script Python**
```typescript
router.post('/importar', async (req, res) => {
  const { ano, uf, municipio, nrCandidato } = req.body;
  const tenantId = req.user.tenantId;

  const pythonProcess = spawn('python3', [
    'src/scripts/tse_import.py', 
    ano, uf, municipio, nrCandidato, tenantId
  ]);
  
  res.json({ status: 'started' });
});
```

- [ ] **Step 2: Criar a View Materializada para o Dashboard**
```sql
CREATE MATERIALIZED VIEW votos_por_bairro AS
SELECT 
    v.ano_eleicao,
    l.nm_bairro,
    v.nr_candidato,
    SUM(v.qt_votos) as total_votos
FROM tse_votos_secao v
JOIN tse_locais_votacao l ON v.nr_local_votacao = l.nr_local_votacao AND v.cd_municipio = l.cd_municipio
GROUP BY 1, 2, 3;
```

---

### Task 5: Interface do Dashboard (Frontend)

**Files:**
- Create: `frontend/src/pages/Dashboard/Eleicoes.tsx`

- [ ] **Step 1: Criar componente de Dashboard com abas (Resumo, Bairros, Escolas)**
- [ ] **Step 2: Implementar Wizard de Configuração inicial**

---
**Auto-Revisão:** O plano cobre todas as tabelas solicitadas, o motor Python e a integração com o frontend. Próximo passo é iniciar a execução.
